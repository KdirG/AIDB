import pandas as pd
import re
from sqlalchemy import text

class SandboxAgent:
    """
    Sandbox işlemlerini, simülasyonları ve veri değişim (Diff) analizlerini yöneten ajan.
    """
    def __init__(self, vanna_instance):
        self.vn = vanna_instance

    def extract_dml_info(self, sql):
        """
        Sorgudan tablo adını ve WHERE koşulunu ayıklar (Unicode destekli).
        """
        sql_clean = sql.strip().replace('\n', ' ')
        table_name = None
        where_clause = ""
        
        # UPDATE [Table] SET ...
        if sql_clean.upper().startswith("UPDATE"):
            match = re.search(r'UPDATE\s+(?:\[?([\w\u00C0-\u017F]+)\]?)\s+SET', sql_clean, re.IGNORECASE | re.UNICODE)
            if match: table_name = match.group(1)
            
        # DELETE FROM [Table] ...
        elif sql_clean.upper().startswith("DELETE"):
            match = re.search(r'DELETE\s+FROM\s+(?:\[?([\w\u00C0-\u017F]+)\]?)', sql_clean, re.IGNORECASE | re.UNICODE)
            if match: table_name = match.group(1)
            
        where_match = re.search(r'\s+(WHERE\s+.*)', sql_clean, re.IGNORECASE)
        if where_match:
            where_clause = where_match.group(1)
            
        return table_name, where_clause

    def execute_with_diff(self, sql, request_id):
        """
        Sorguyu çalıştırır ve eski/yeni halini (Diff) döndürür.
        """
        table_name, where_clause = self.extract_dml_info(sql)
        before_data = []
        after_data = []
        
        try:
            with self.vn.engine.connect() as conn:
                # 1. Önceki hali yedekle
                if table_name:
                    try:
                        before_df = pd.read_sql(f"SELECT * FROM [{table_name}] {where_clause}", self.vn.engine)
                        before_data = before_df.to_dict(orient="records")
                    except: pass
                
                # 2. İşlemi yap
                conn.execute(text(sql))
                
                # 3. Sonraki hali çek
                if table_name:
                    try:
                        after_df = pd.read_sql(f"SELECT * FROM [{table_name}] {where_clause}", self.vn.engine)
                        after_data = after_df.to_dict(orient="records")
                    except: pass
                    
            return {
                "status": "SUCCESS",
                "beforeData": before_data,
                "afterData": after_data,
                "tableName": table_name
            }
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}

    def run_simulation(self, sql, request_id):
        """
        Gerçek tabloya dokunmadan ##SIM_ tablolarında simülasyon yapar.
        """
        table_name, where_clause = self.extract_dml_info(sql)
        if not table_name:
            return {"status": "ERROR", "message": "Tablo ismi belirlenemedi."}

        try:
            safe_table = f"[{table_name}]"
            sim_table = f"##SIM_{table_name}_{request_id[:8]}"
            safe_sim_table = f"[{sim_table}]"
            
            before_data = []
            
            with self.vn.engine.connect() as conn:
                # 1. Eski hali oku
                try:
                    before_df = pd.read_sql(f"SELECT * FROM {safe_table} {where_clause}", self.vn.engine)
                    before_data = before_df.to_dict(orient="records")
                except: pass

                try: conn.execute(text(f"DROP TABLE {safe_sim_table}"))
                except: pass
                
                # Klonla
                conn.execute(text(f"SELECT * INTO {safe_sim_table} FROM {safe_table} {where_clause}"))
                
                # Simülasyonu çalıştır
                sim_sql = sql.replace(table_name, sim_table)
                conn.execute(text(sim_sql))
                
                # Sonucu oku
                preview_df = pd.read_sql(f"SELECT * FROM {safe_sim_table}", self.vn.engine)
                preview_data = preview_df.to_dict(orient="records")
                
                try: conn.execute(text(f"DROP TABLE {safe_sim_table}"))
                except: pass
                
                return {
                    "status": "SUCCESS",
                    "resultData": preview_data,
                    "beforeData": before_data,
                    "tableName": table_name
                }
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
