import redis
import json
import re
import pandas as pd
import datetime
import traceback
import plotly.utils
import plotly.express as px
import random
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import NullPool
from urllib.parse import quote_plus, unquote

def generate_chart_logic(df, query):
    if df is None or df.empty:
        return None
    try:
        num_cols = df.select_dtypes(include=['number']).columns.tolist()
        cat_cols = df.select_dtypes(exclude=['number']).columns.tolist()
        
        if len(num_cols) > 0 and len(cat_cols) > 0:
            fig = px.bar(df, x=cat_cols[0], y=num_cols[0], title="Sonuç Grafiği")
            return json.loads(fig.to_json())
        elif len(num_cols) >= 2:
            fig = px.scatter(df, x=num_cols[0], y=num_cols[1], title="Sonuç Grafiği")
            return json.loads(fig.to_json())
        elif len(num_cols) == 1:
            fig = px.line(df, y=num_cols[0], title="Sonuç Grafiği")
            return json.loads(fig.to_json())
    except Exception as e:
        print(f"[Chart Error] {e}")
    return None


# Ajanlarımız
from agents.translator import TranslatorAgent
from agents.vanna_agent import vn as vanna 
from agents.refiner import RefinerAgent 
from agents.validator import ValidatorAgent

# --- AYARLAR ---
r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
REQUEST_CHANNEL = "aidb_prompt_queue"
RESPONSE_CHANNEL = "aidb_response_queue"

translator = TranslatorAgent()
refiner = RefinerAgent()
validator = ValidatorAgent()

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
    # DML: Veri değiştirme
    if any(w in sql_upper for w in ["DELETE ", "UPDATE ", "INSERT ", "TRUNCATE ", "MERGE "]):
        return "DML"
    # DDL: Yapı değiştirme
    if any(w in sql_upper for w in ["DROP ", "CREATE ", "ALTER ", "RENAME "]):
        return "DDL"
    # EXEC: Saklı yordamlar (Genelde DML/DDL etkisi olabilir)
    if sql_upper.startswith("EXEC") or "SP_RENAME" in sql_upper:
        return "DDL"
    # DQL: Okuma
    if sql_upper.startswith("SELECT") or sql_upper.startswith("WITH"):
        return "DQL"
    return "UNKNOWN"

def build_conn_str(data):
    """
    Java'dan gelen JDBC URL'ini Python SQLAlchemy formatına çevirir.
    """
    jdbc_url = data.get("connectionUrl", "")
    db_type = data.get("dbType", "mssql").lower()
    database_name = data.get("databaseName", "")

    # GÜVENLİK: Eğer hiçbir bağlantı parametresi yoksa (ör. EXECUTE_CONFIRMED adımında), halihazırdaki bağlantıyı (vanna.db_url) koru. 
    # Kendi kendine 'master' veritabanına geçme!
    if not jdbc_url and not database_name:
        return ""

    # 1. Senaryo: JDBC URL gelmişse (Integrated Security Destekli)
    if jdbc_url and jdbc_url.startswith("jdbc:sqlserver://"):
        try:
            clean_url = jdbc_url.replace("jdbc:sqlserver://", "")
            main_parts = clean_url.split(';')
            server_host = main_parts[0] 
            
            params = {}
            for p in main_parts[1:]:
                if '=' in p:
                    k, v = p.split('=', 1)
                    params[k.lower()] = v.strip()

            db_name = params.get("databasename", "")
            if not db_name:
                db_name = "master"
            driver = quote_plus("ODBC Driver 17 for SQL Server")

            base_str = ""
            if params.get("integratedsecurity", "").lower() == "true":
                base_str = f"mssql+pyodbc://{server_host}/{db_name}?driver={driver}&trusted_connection=yes"
            else:
                user = params.get("user", "")
                pwd = quote_plus(params.get("password", ""))
                base_str = f"mssql+pyodbc://{user}:{pwd}@{server_host}/{db_name}?driver={driver}"
                
            if params.get("encrypt", "").lower() in ["true", "mandatory", "yes"]:
                base_str += "&Encrypt=yes"
            elif params.get("encrypt", "").lower() in ["false", "no"]:
                base_str += "&Encrypt=no"
                
            if params.get("trustservercertificate", "").lower() in ["true", "yes"]:
                base_str += "&TrustServerCertificate=yes"
                
            return base_str
        except Exception as e:
            print(f"[Worker] JDBC Parsing Hatası: {e}")

    # 2. Senaryo: Eski Manuel Bilgiler (Yedek)
    server = data.get("serverName") or data.get("host") or "localhost"
        
    database = database_name
    if not database:
        database = "master"
    user = data.get("username", "")
    pwd = data.get("password", "")

    if "mssql" in db_type:
        driver = quote_plus("ODBC Driver 17 for SQL Server")
        suffix = f"&driver={driver}&TrustServerCertificate=yes"
        if not user or user.strip() == "":
            return f"mssql+pyodbc://{server}/{database}?trusted_connection=yes{suffix}"
        else:
            return f"mssql+pyodbc://{user}:{quote_plus(pwd)}@{server}/{database}?{suffix}"
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

def extract_dml_info(sql):
    """
    Sorgudan tablo adını ve WHERE koşulunu ayıklar.
    Unicode (Türkçe karakter vb.) destekli.
    """
    sql_clean = sql.strip().replace('\n', ' ')
    table_name = None
    where_clause = ""
    
    # UPDATE [Table] SET ...
    match_update = re.search(r'UPDATE\s+(?:\[?([\w\u00C0-\u017F]+)\]?)\s+SET', sql_clean, re.IGNORECASE | re.UNICODE)
    if match_update: 
        table_name = match_update.group(1)
        
    # DELETE FROM [Table] ...
    elif re.search(r'DELETE\s+FROM\s+(?:\[?([\w\u00C0-\u017F]+)\]?)', sql_clean, re.IGNORECASE | re.UNICODE):
        match_delete = re.search(r'DELETE\s+FROM\s+(?:\[?([\w\u00C0-\u017F]+)\]?)', sql_clean, re.IGNORECASE | re.UNICODE)
        if match_delete: table_name = match_delete.group(1)
        
    # WHERE kısmını yakala
    where_match = re.search(r'\s+(WHERE\s+.*)', sql_clean, re.IGNORECASE)
    if where_match:
        where_clause = where_match.group(1)
        
    return table_name, where_clause

def handle_request(message):
    try:
        raw_payload = json.loads(message['data'])
        request_type = raw_payload.get("type", "QUERY")
        request_id = raw_payload.get("requestId")
        user_prompt = raw_payload.get("rawPrompt") or raw_payload.get("prompt") or ""
        confirmed_sql = raw_payload.get("generatedSql", "")
        
        # ✨ Java'dan gelen canModify (DML) yetkisini al ✨
        user_can_modify = raw_payload.get("allowDdl", False)

        # ✨ KRİTİK: Bağlantıyı Her İşlemde Kontrol Et ✨
        new_conn_str = build_conn_str(raw_payload)
        if new_conn_str:
            # Eğer engine yoksa veya URL değişmişse yeniden bağlan
            if not vanna.engine or getattr(vanna, 'db_url', None) != new_conn_str:
                print(f"[Worker] Bağlantı Hazırlanıyor: {new_conn_str}")
                vanna.set_db_connection(new_conn_str)
                vanna.db_url = new_conn_str
        
        final_response = {
            "requestId": request_id, "status": "PENDING", "type": request_type,
            "sqlType": "UNKNOWN", "rawPrompt": user_prompt, "generatedSql": confirmed_sql,
            "resultData": [], "chart": None, "answer": "", "errorMessage": ""
        }

        # 1. CONNECT İŞLEMİ
        if request_type == "CONNECT":
            # Frontend'in SSE bağlantısını kurabilmesi için çok kısa bir süre bekle (Race condition önlemi)
            import time
            time.sleep(1.0)
            
            # Test amaçlı bağlandıysek sadece engine oluşmuş mu diye bakıyoruz
            if not vanna.engine:
                final_response["status"] = "ERROR"
                final_response["errorMessage"] = "Gerçek bağlantı kurulamadı (ODBC/TCP Hatası veya Sunucu Yanıt Vermedi)."
            else:
                final_response["status"] = "SUCCESS"
                final_response["answer"] = "✅ Veritabanı profili hazır ve teste bağlandı."
            r.publish(RESPONSE_CHANNEL, json.dumps(final_response, default=str))
            return

        # 2. ONAYLANMIŞ SORGULAR
        elif request_type == "EXECUTE_CONFIRMED":
            # Eğer worker yeni başladıysa ve hafızasında URL yoksa arayüzden gelmesini bekleriz
            target_url = getattr(vanna, 'db_url', None) or new_conn_str
            
            if not target_url:
                final_response.update({"status": "ERROR", "errorMessage": "⚠️ Bağlantı koptu. Lütfen veritabanını tekrar seçip işlemi yeniden deneyin."})
                r.publish(RESPONSE_CHANNEL, json.dumps(final_response, default=str))
                return

            print(f"[Worker] EXECUTE_CONFIRMED alındı. Vanna DB URL: {target_url}")
            print(f"[Worker] Çalıştırılacak Onaylı SQL: {confirmed_sql}")
            try:
                sql_type = classify_sql(confirmed_sql)
                from sqlalchemy import text
                # ✨ OTOMATİK TEMPORAL TABLE YAPILANDIRMASI ✨
                if sql_type == "DML":
                    table_name, _ = extract_dml_info(confirmed_sql)
                    if table_name:
                        try:
                            print(f"[Worker-DEBUG] DML Tablo bulundu: {table_name}. Temporal kontrolü için bağlantı açılıyor...")
                            with vanna.engine.begin() as conn:
                                # Tablo temporal mı kontrol et
                                check_temporal_sql = f"SELECT temporal_type FROM sys.tables WHERE object_id = OBJECT_ID('{table_name}')"
                                print(f"[Worker-DEBUG] Temporal sorgusu çalıştırılıyor: {check_temporal_sql}")
                                result = conn.execute(text(check_temporal_sql)).scalar()
                                print(f"[Worker-DEBUG] Temporal durumu: {result}")
                                
                                if result == 0: # 0 = NON_TEMPORAL_TABLE
                                    print(f"[Worker] Tablo temporal değil. Otomatik dönüştürülüyor: {table_name}")
                                    conn.execute(text(f"ALTER TABLE [{table_name}] ADD SysStartTime DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL DEFAULT SYSUTCDATETIME(), SysEndTime DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.9999999'), PERIOD FOR SYSTEM_TIME (SysStartTime, SysEndTime);"))
                                    conn.execute(text(f"ALTER TABLE [{table_name}] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.[{table_name}_History]));"))
                                    print(f"[Worker] {table_name} başarıyla temporal yapıldı.")
                        except Exception as temp_err:
                            print(f"[Worker] Otomatik Temporal yapılandırma hatası: {temp_err}")
                
                import time
                start_exec = time.time()
                
                # SQLAlchemy ile DML işlemlerini açıkça Commit etmemiz lazım, yoksa pandas kilitler (Deadlock)
                if sql_type == "DML":
                    print("[Worker-DEBUG] DML işlemi çalıştırılıyor (auto-commit block)...")
                    with vanna.engine.begin() as conn:
                        conn.execute(text(confirmed_sql))
                    print("[Worker-DEBUG] DML işlemi başarıyla tamamlandı ve Commit edildi.")
                    df = None
                else:
                    print("[Worker-DEBUG] SELECT sorgusu çalıştırılıyor...")
                    df = vanna.run_sql(confirmed_sql)
                    print("[Worker-DEBUG] SELECT işlemi tamamlandı.")
                    
                exec_duration = int((time.time() - start_exec) * 1000)
                
                # ✨ OTOMATİK VERİ LİSTELEME (DML SONRASI) ✨
                if sql_type == "DML" and table_name:
                    try:
                        print(f"[Worker-DEBUG] Güncel veriler çekiliyor: SELECT TOP 100 * FROM [{table_name}]")
                        df = vanna.run_sql(f"SELECT TOP 100 * FROM [{table_name}]")
                        for col in df.select_dtypes(include=['datetime64', 'datetime', 'datetimetz']).columns:
                            df[col] = df[col].dt.strftime('%Y-%m-%d %H:%M:%S')
                        print("[Worker-DEBUG] Güncel veriler başarıyla çekildi.")
                    except Exception as show_err:
                        print(f"[Worker] Otomatik tablo getirme hatası: {show_err}")

                final_response.update({
                    "status": "SUCCESS", 
                    "answer": random.choice(SUCCESS_ANSWERS) + " İşlem sonrası güncel kayıtlar aşağıda listelenmiştir.",
                    "resultData": df.to_dict(orient="records") if df is not None and not df.empty else [],
                    "generatedSql": confirmed_sql,
                    "sqlType": classify_sql(confirmed_sql),
                    "executionTime": exec_duration
                })
            except Exception as e:
                print(f"[Worker] Onaylı SQL çalıştırılırken HATA: {e}")
                final_response.update({"status": "ERROR", "errorMessage": str(e)})
            r.publish(RESPONSE_CHANNEL, json.dumps(final_response, default=str))
            return

        # 3. GEÇMİŞ BİLGİSİ (TEMPORAL TABLE)
        elif request_type == "HISTORY_QUERY":
            if not vanna.engine:
                final_response.update({"status": "ERROR", "errorMessage": "Veritabanı bağlantısı kurulamadı."})
                r.publish(RESPONSE_CHANNEL, json.dumps(final_response, default=str))
                return
            
            row_data = raw_payload.get("rowData", {})
            original_sql = raw_payload.get("originalSql", "")
            
            print(f"[Worker] HISTORY_QUERY Alındı. Row: {row_data}, SQL: {original_sql}")

            # Tabloyu bul
            match = re.search(r'FROM\s+(?:(?:the|a|an)\s+)?\[?([A-Za-z_][\w\u00C0-\u017F]*)\]?', original_sql, re.IGNORECASE)
            if not match:
                match_dml = re.search(r'(?:UPDATE|INTO)\s+\[?([\w\u00C0-\u017F]+)\]?', original_sql, re.IGNORECASE)
                if match_dml:
                    table_name = match_dml.group(1)
                else:
                    final_response.update({"status": "ERROR", "errorMessage": "Orijinal sorgudan tablo adı çıkarılamadı."})
                    r.publish(RESPONSE_CHANNEL, json.dumps(final_response, default=str))
                    return
            else:
                table_name = match.group(1)
            
            # PK bul
            inspector = inspect(vanna.engine)
            pk_col = None
            pk_val = None
            try:
                pk_info = inspector.get_pk_constraint(table_name)
                if pk_info and pk_info.get('constrained_columns'):
                    pk_col_real = pk_info['constrained_columns'][0]
                    # Row data içinde case-insensitive ara
                    for k, v in row_data.items():
                        if k.lower() == pk_col_real.lower():
                            pk_col = pk_col_real
                            pk_val = v
                            break
            except Exception as e:
                print(f"[Worker] PK Constraint bulunamadı: {e}")
                pass
                
            if not pk_col:
                # Fallback: find 'id' or 'ID'
                for k, v in row_data.items():
                    if k.lower() == 'id':
                        pk_col = k
                        pk_val = v
                        break
            if not pk_col:
                # Get the first column as PK
                pk_col = list(row_data.keys())[0]
                pk_val = list(row_data.values())[0]
                
            # FOR SYSTEM_TIME ALL sorgusu oluştur
            if isinstance(pk_val, str):
                pk_val_clean = pk_val.replace("'", "''")
                history_sql = f"SELECT *, SysStartTime, SysEndTime FROM [{table_name}] FOR SYSTEM_TIME ALL WHERE [{pk_col}] = '{pk_val_clean}' ORDER BY CASE WHEN SysEndTime >= '9999-12-31' THEN SysStartTime ELSE SysEndTime END DESC"
            else:
                history_sql = f"SELECT *, SysStartTime, SysEndTime FROM [{table_name}] FOR SYSTEM_TIME ALL WHERE [{pk_col}] = {pk_val} ORDER BY CASE WHEN SysEndTime >= '9999-12-31' THEN SysStartTime ELSE SysEndTime END DESC"
                
            print(f"[Worker] Çalıştırılacak History SQL: {history_sql}")
            
            try:
                df = pd.read_sql(history_sql, vanna.engine)
                # Convert dates
                for col in df.select_dtypes(include=['datetime64', 'datetime', 'datetimetz']).columns:
                    df[col] = df[col].dt.strftime('%Y-%m-%d %H:%M:%S.%f')
                    
                final_response.update({
                    "status": "SUCCESS",
                    "resultData": df.to_dict(orient="records"),
                    "generatedSql": history_sql
                })
            except Exception as e:
                print(f"[Worker] History Hatası: {e}")
                err_str = str(e)
                if "not a system-versioned table" in err_str or "13544" in err_str:
                    final_response.update({"status": "ERROR", "errorMessage": f"📋 Bu tabloda henüz veri değişikliği yapılmamıştır. Geçmiş kaydı yalnızca UPDATE/DELETE işlemi sonrasında tutulur."})
                else:
                    final_response.update({"status": "ERROR", "errorMessage": err_str})
                
            r.publish(RESPONSE_CHANNEL, json.dumps(final_response, default=str))
            return


        # 4. NORMAL QUERY (Sorgu) VEYA SİSTEM GERİ YÜKLEME (RESTORE)
        elif request_type == "QUERY":
            if not vanna.engine:
                raise Exception("Veritabanı bağlantısı kurulamadı. URL eksik veya hatalı.")

            # ✨ DETERMINISTIC RESTORE (AI KULLANILMAZ) ✨
            if user_prompt.startswith("[SYSTEM_RESTORE]"):
                payload_str = user_prompt.replace("[SYSTEM_RESTORE]", "").strip()
                payload = json.loads(payload_str)
                
                # Tablo ve PK çözümü
                match = re.search(r'FROM\s+(?:(?:the|a|an)\s+)?\[?([A-Za-z_][\w\u00C0-\u017F]*)\]?', payload["originalSql"], re.IGNORECASE)
                if not match: raise Exception("Orijinal sorgudan tablo adı çıkarılamadı.")
                table_name = match.group(1)
                
                inspector = inspect(vanna.engine)
                pk_col = None
                try:
                    pk_info = inspector.get_pk_constraint(table_name)
                    if pk_info and pk_info.get('constrained_columns'):
                        pk_col = pk_info['constrained_columns'][0]
                except: pass
                
                if not pk_col:
                    pk_col = list(payload["rowData"].keys())[0] # Fallback: ilk kolon
                    
                pk_val = payload["rowData"].get(pk_col)
                if pk_val is None: raise Exception("Primary Key değeri bulunamadı.")

                # Programmatic UPDATE statement (Hallucination riski yok)
                set_clauses = []
                for k, v in payload["rowData"].items():
                    if k.upper() not in ['SYSSTARTTIME', 'SYSENDTIME']:
                        if v is None:
                            set_clauses.append(f"[{k}] = NULL")
                        else:
                            val_str = str(v).replace("'", "''")
                            set_clauses.append(f"[{k}] = '{val_str}'")
                
                pk_val_str = str(pk_val).replace("'", "''")
                generated_sql = f"UPDATE [{table_name}] SET {', '.join(set_clauses)} WHERE [{pk_col}] = '{pk_val_str}';"
                
                final_response.update({
                    "sqlType": "DML",
                    "generatedSql": generated_sql,
                    "status": "AWAITING_APPROVAL",
                    "answer": "Geri Yükleme Kodu Oluşturuldu. Lütfen Onaylayın.",
                    "connectionUrl": new_conn_str,
                    "dbId": raw_payload.get("dbId"),
                    "allowDdl": user_can_modify,
                    "rawPrompt": "Geçmiş Versiyona Dönüş İsteği (System Restore)"
                })
                r.publish(RESPONSE_CHANNEL, json.dumps(final_response, default=str))
                return

            # ✨ DETERMINISTIC ARCHIVE LISTING (AI KULLANILMAZ) ✨
            if user_prompt.startswith("[SYSTEM_ARCHIVE]"):
                payload_str = user_prompt.replace("[SYSTEM_ARCHIVE]", "").strip()
                payload = json.loads(payload_str)
                
                # Tablo çözümü
                match = re.search(r'FROM\s+(?:(?:the|a|an)\s+)?\[?([A-Za-z_][\w\u00C0-\u017F]*)\]?', payload["originalSql"], re.IGNORECASE)
                if not match: 
                    # Belki UPDATE veya INSERT ile başlıyor
                    match_dml = re.search(r'(?:UPDATE|INTO)\s+\[?([\w\u00C0-\u017F]+)\]?', payload["originalSql"], re.IGNORECASE)
                    if match_dml:
                        table_name = match_dml.group(1)
                    else:
                        raise Exception("Sorgudan tablo adı çıkarılamadı.")
                else:
                    table_name = match.group(1)
                
                archive_sql = f"SELECT TOP 100 *, SysStartTime, SysEndTime FROM [{table_name}] FOR SYSTEM_TIME ALL ORDER BY CASE WHEN SysEndTime >= '9999-12-31' THEN SysStartTime ELSE SysEndTime END DESC"
                
                import time
                start_exec = time.time()
                try:
                    df = vanna.run_sql(archive_sql)
                    exec_duration = int((time.time() - start_exec) * 1000)
                    
                    if df is not None and not df.empty:
                        for col in df.select_dtypes(include=['datetime64', 'datetime']).columns:
                            df[col] = df[col].dt.strftime('%Y-%m-%d %H:%M:%S')
                            
                    final_response.update({
                        "status": "SUCCESS", 
                        "resultData": df.to_dict(orient="records") if df is not None and not df.empty else [],
                        "generatedSql": archive_sql,
                        "sqlType": "DQL",
                        "executionTime": exec_duration,
                        "answer": f"{table_name} tablosuna ait sistem arşivi (Temporal History) başarıyla getirildi. Listeden dilediğiniz satırı 'Geri Yükle' butonuyla kurtarabilirsiniz."
                    })
                except Exception as e:
                    err_str = str(e)
                    if "not a system-versioned table" in err_str or "13544" in err_str:
                        final_response.update({
                            "status": "ERROR", 
                            "errorMessage": f"📋 [{table_name}] tablosunda henüz herhangi bir veri değişikliği (UPDATE/DELETE) yapılmamıştır. Geçmiş kaydı (Temporal History) yalnızca değişiklik yapılan tablolarda tutulur. Bu tabloda bir güncelleme veya silme işlemi gerçekleştirdikten sonra arşive erişebilirsiniz."
                        })
                    else:
                        final_response.update({"status": "ERROR", "errorMessage": "Arşiv listelenirken hata oluştu: " + err_str})

                final_response.update({
                    "connectionUrl": new_conn_str,
                    "dbId": raw_payload.get("dbId"),
                    "allowDdl": user_can_modify,
                    "rawPrompt": "Tüm Tablo Geçmişini Görüntüleme İsteği (System Archive)"
                })
                r.publish(RESPONSE_CHANNEL, json.dumps(final_response, default=str))
                return

            # ✨ STANDART AI SORGUSU ✨
            mode = raw_payload.get("needsRefinement", True)
            try:
                t_res = translator.process({"rawPrompt": user_prompt})
                eng_query = t_res.get("englishPrompt", "").strip() or user_prompt
                schema = get_schema_meta(vanna.engine)
                refiner_res = refiner.process({"translatedPrompt": eng_query, "dbSchema": schema, "useSmartMode": mode})
                generated_sql = clean_sql(refiner_res.get("generatedSql", ""))

                if not generated_sql: raise Exception("SQL üretilemedi.")
                
                sql_type = classify_sql(generated_sql)
                final_response["sqlType"] = sql_type
                final_response["generatedSql"] = generated_sql

                # A) SELECT Sorgusu
                if sql_type == "DQL":
                    import time
                    start_exec = time.time()
                    df = vanna.run_sql(generated_sql)
                    exec_duration = int((time.time() - start_exec) * 1000)
                    
                    chart_data = None
                    if not df.empty:
                        chart_data = generate_chart_logic(df, eng_query)
                    for col in df.select_dtypes(include=['datetime64', 'datetime']).columns:
                        df[col] = df[col].dt.strftime('%Y-%m-%d %H:%M:%S')
                    
                    final_response.update({
                        "status": "SUCCESS", "resultData": df.to_dict(orient="records"),
                        "chart": chart_data, "answer": random.choice(ANSWERS_POOL),
                        "executionTime": exec_duration
                    })

                # B) DML/DDL veya UNKNOWN Sorgusu (Tam Yetkili Kullanıcılar İçin)
                elif (sql_type in ["DML", "DDL", "UNKNOWN"]) and user_can_modify:
                    final_response.update({
                        "status": "AWAITING_APPROVAL",
                        "answer": f"Kritik işlem talebi alındı. Bu komut veritabanını değiştirecektir. Lütfen SQL kodunu inceleyip onaylayın."
                    })

                # C) Yetki Yoksa Direkt Reddet
                else:
                    final_response.update({
                        "status": "ERROR",
                        "errorMessage": f"❌ Yetki reddedildi: Bu işlem veritabanı üzerinde kalıcı değişiklik ({sql_type}) yapmayı amaçlamaktadır. Sadece okuma yetkiniz bulunmaktadır."
                    })
                
                final_response.update({
                    "connectionUrl": new_conn_str,
                    "dbId": raw_payload.get("dbId"),
                    "allowDdl": user_can_modify,
                    "rawPrompt": user_prompt
                })
                r.publish(RESPONSE_CHANNEL, json.dumps(final_response, default=str))
            except Exception as e:
                print(f"[Worker Inner Error] QUERY error: {str(e)}")
                traceback.print_exc()
                final_response.update({"status": "ERROR", "errorMessage": str(e), "connectionUrl": new_conn_str})
                r.publish(RESPONSE_CHANNEL, json.dumps(final_response, default=str))

    except Exception as e:
        print(f"[KRİTİK HATA]: {str(e)}")
        print(f"DEBUG Payload: {raw_payload if 'raw_payload' in locals() else 'Payload okunamadı'}")
        traceback.print_exc()

def main():
    print(f"[*] AIDB Worker Aktif. Dinamik Bağlantı Modu Devrede.")
    p = r.pubsub()
    p.subscribe(REQUEST_CHANNEL)
    for message in p.listen():
        if message['type'] == 'message':
            handle_request(message)

if __name__ == "__main__":
    main()