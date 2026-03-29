import redis
import json
import re
import pandas as pd
import datetime
import traceback
import plotly.utils
import random
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import NullPool  # ✨ Bağlantı kilitlenmelerini önlemek için kritik
from urllib.parse import quote_plus

# Ajanlarımız
from agents.translator import TranslatorAgent
from agents.vanna_agent import vn as vanna 
from agents.refiner import RefinerAgent 
from agents.validator import ValidatorAgent

# --- AYARLAR ---
r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
REQUEST_CHANNEL = "aidb_prompt_queue"
RESPONSE_CHANNEL = "aidb_response_queue"

# Ajanları Başlat
translator = TranslatorAgent()
refiner = RefinerAgent()
validator = ValidatorAgent()

# --- RANDOM CEVAP HAVUZLARI ---
ANSWERS_POOL = [
    "İstediğiniz verileri analiz ettim, sonuçlar aşağıda listelenmiştir.",
    "Sorgu başarıyla tamamlandı, ilgili kayıtları hazırladım.",
    "Veritabanı tarandı ve aradığınız bilgilere ulaşıldı.",
    "Analiz sonuçları hazır; detayları aşağıda inceleyebilirsiniz.",
    "Verileriniz başarıyla çekildi, raporunuzu hazırladım."
]

SUCCESS_ANSWERS = [
    "İşlem başarıyla tamamlandı, veritabanı güncellendi.",
    "İstediğiniz değişiklik uygulandı, her şey yolunda!",
    "Tablo/Sütun operasyonu başarıyla sonuçlandı.",
    "Hedef operasyon onaylandı ve veritabanına işlendi.",
    "Değişiklikler kalıcı hale getirildi, işlem başarılı."
]

def classify_sql(sql):
    sql_upper = sql.strip().upper()
    if any(w in sql_upper for w in ["DELETE ", "UPDATE ", "INSERT ", "TRUNCATE "]):
        return "DML"
    if any(w in sql_upper for w in ["DROP ", "CREATE ", "ALTER "]):
        return "DDL"
    if sql_upper.startswith("SELECT") or sql_upper.startswith("WITH"):
        return "DQL"
    return "UNKNOWN"

def build_conn_str(data):
    db_type = data.get("dbType", "").lower()
    server = data.get("serverName", "")
    database = data.get("databaseName", "")
    user = data.get("username", "")
    pwd = data.get("password", "")
    if "mssql" in db_type:
        driver = "ODBC Driver 17 for SQL Server"
        if not user or not pwd or user.strip() == "":
            return f"mssql+pyodbc://{server}/{database}?driver={quote_plus(driver)}&trusted_connection=yes"
        else:
            return f"mssql+pyodbc://{user}:{quote_plus(pwd)}@{server}/{database}?driver={quote_plus(driver)}"
    return ""

def get_schema_meta(engine):
    try:
        inspector = inspect(engine)
        meta = "### DATABASE SCHEMA:\n"
        for table in inspector.get_table_names():
            cols = [c['name'] for c in inspector.get_columns(table)]
            meta += f"Table [{table}] Columns: {cols}\n"
        return meta
    except Exception as e:
        return f"Schema Error: {str(e)}"

def clean_sql(sql_to_run):
    if not sql_to_run: return ""
    sql_to_run = re.sub(r'```sql|```', '', sql_to_run, flags=re.IGNORECASE)
    sql_to_run = sql_to_run.strip().strip(';')
    return sql_to_run

def generate_chart_logic(df, prompt):
    try:
        fig = vanna.get_plotly_figure(vanna.generate_plotly_code(question=prompt, df=df), df=df)
        chart_json = json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
        return chart_json
    except Exception as e:
        print(f"[Worker] Grafik üretim hatası: {str(e)}")
        return None

def handle_request(message):
    try:
        raw_payload = json.loads(message['data'])
        request_type = raw_payload.get("type", "QUERY")
        request_id = raw_payload.get("requestId")
        user_prompt = raw_payload.get("rawPrompt") or raw_payload.get("prompt") or ""
        confirmed_sql = raw_payload.get("generatedSql", "")

        final_response = {
            "requestId": request_id,
            "status": "PENDING",
            "type": request_type,
            "sqlType": "UNKNOWN",
            "rawPrompt": user_prompt,
            "generatedSql": confirmed_sql,
            "resultData": [],
            "chart": None,
            "answer": "",
            "errorMessage": ""
        }

        # 1. BAĞLANTI İŞLEMİ
        if request_type == "CONNECT":
            try:
                conn_str = build_conn_str(raw_payload) 
                success = vanna.set_db_connection(conn_str)
                if success:
                    final_response["status"] = "SUCCESS"
                    final_response["answer"] = "Bağlantı başarılı. Yazma ve okuma yetkileri tanımlandı."
                else:
                    raise Exception("Veritabanı doğrulanamadı.")
            except Exception as e:
                final_response["status"] = "ERROR"
                final_response["errorMessage"] = str(e)
            r.publish(RESPONSE_CHANNEL, json.dumps(final_response))
            return

        # 2. ✨ ONAYLANMIŞ SORGULARI İNFAZ ETME (DDL/DML) ✨
        elif request_type == "EXECUTE_CONFIRMED":
            try:
                print(f"[Worker] ADMIN ONAYI ALINDI. İnfaz ediliyor: {confirmed_sql}")
                
                temp_engine = create_engine(vanna.db_url, poolclass=NullPool)
                with temp_engine.begin() as connection:
                    statements = confirmed_sql.split(';')
                    for stmt in statements:
                        if stmt.strip():
                            connection.execute(text(stmt))
                
                temp_engine.dispose()
                print("[Worker] İnfaz başarıyla tamamlandı.")
                
                # ✨ FRONTEND DOSTU CEVAP ✨
                final_response.update({
                    "status": "SUCCESS", # Bu sayede loading kapanır
                    "type": "EXECUTE_CONFIRMED",
                    "resultData": [],
                    "answer": random.choice(SUCCESS_ANSWERS) # Chate düşecek random mesaj
                })
            except Exception as e:
                print(f"[Worker] İnfaz Hatası: {str(e)}")
                final_response.update({
                    "status": "ERROR",
                    "errorMessage": f"İnfaz Hatası: {str(e)}",
                    "answer": "❌ İşlem gerçekleştirilemedi."
                })
            
            r.publish(RESPONSE_CHANNEL, json.dumps(final_response))
            return

        # 3. NORMAL SORGULAMA VE SINIFLANDIRMA
        elif request_type == "QUERY":
            mode = raw_payload.get("needsRefinement", True)
            try:
                t_res = translator.process({"rawPrompt": user_prompt})
                eng_query = t_res.get("englishPrompt", "").strip() or user_prompt
                
                schema = get_schema_meta(vanna.engine) if vanna.engine else ""
                refiner_res = refiner.process({"translatedPrompt": eng_query, "dbSchema": schema, "useSmartMode": mode})
                generated_sql = clean_sql(refiner_res.get("generatedSql", ""))

                if not generated_sql: raise Exception("SQL üretilemedi.")
                
                sql_type = classify_sql(generated_sql)
                final_response["sqlType"] = sql_type
                final_response["generatedSql"] = generated_sql

                if sql_type == "DQL":
                    df = vanna.run_sql(generated_sql)
                    chart_data = None
                    if not df.empty:
                        chart_data = generate_chart_logic(df, eng_query)
                    
                    for col in df.select_dtypes(include=['datetime64', 'datetime']).columns:
                        df[col] = df[col].dt.strftime('%Y-%m-%d %H:%M:%S')
                    
                    final_response.update({
                        "status": "SUCCESS",
                        "resultData": df.to_dict(orient="records"),
                        "chart": chart_data,
                        "answer": random.choice(ANSWERS_POOL)
                    })
                else:
                    final_response.update({
                        "status": "AWAITING_APPROVAL",
                        "answer": f"⚠️ Bu bir {sql_type} işlemidir. Sistem güvenliği gereği Admin onayı bekleniyor."
                    })
                
                r.publish(RESPONSE_CHANNEL, json.dumps(final_response))
                return 

            except Exception as e:
                final_response["status"] = "ERROR"
                final_response["errorMessage"] = f"Hata: {str(e)}"
                r.publish(RESPONSE_CHANNEL, json.dumps(final_response))
                return

    except Exception as e:
        print(f"[KRİTİK HATA]: {str(e)}")
        traceback.print_exc()

def main():
    print(f"[*] AIDB Worker Aktif. DDL/DML Güvenlik Filtresi Devrede.")
    p = r.pubsub()
    p.subscribe(REQUEST_CHANNEL)
    for message in p.listen():
        if message['type'] == 'message':
            handle_request(message)

if __name__ == "__main__":
    main()