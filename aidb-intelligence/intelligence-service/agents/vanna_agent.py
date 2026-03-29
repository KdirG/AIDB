import json
import pandas as pd
from sqlalchemy import create_engine, inspect, text
from vanna.legacy.ollama import Ollama
from vanna.legacy.chromadb import ChromaDB_VectorStore

class AIDBVanna(ChromaDB_VectorStore, Ollama):
    def __init__(self, config=None, db_url=None):
        config = config or {'model': 'qwen2.5-coder'}
        ChromaDB_VectorStore.__init__(self, config={'path': './vanna_storage'})
        Ollama.__init__(self, config=config)
        self.allow_llm_to_see_data = True
        self.engine = None
        self.db_url = None
        self.db_type = None
        self.is_connected = False
        
        if db_url:
            self.set_db_connection(db_url)

    def set_db_connection(self, db_url: str, db_type: str = None):
        try:
            if self.engine: self.engine.dispose()
            
            # ✨ GÜNCELLEME: DML/DDL işlemleri için AUTOCOMMIT modunu açıyoruz
            self.engine = create_engine(db_url, isolation_level="AUTOCOMMIT")
            self.db_url = db_url
            self.db_type = db_type or self._detect_db_type(db_url)
            
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            # ✨ GÜNCELLEME: run_sql artık hem SELECT hem EXECUTE yapabilir
            def run_sql(sql: str) -> pd.DataFrame:
                sql_upper = sql.strip().upper()
                
                # Eğer sorgu bir SELECT veya WITH değilse (yani DELETE, ALTER vb. ise)
                if not (sql_upper.startswith("SELECT") or sql_upper.startswith("WITH")):
                    with self.engine.begin() as conn:
                        conn.execute(text(sql))
                    return pd.DataFrame() # Yazma işlemlerinde boş tablo dön
                
                # Normal SELECT işlemleri için
                return pd.read_sql(sql, self.engine)
            
            self.run_sql = run_sql
            self.is_connected = True
            return True
        except Exception as e:
            self.is_connected = False
            raise Exception(f"Database connection failed: {str(e)}")

    def _detect_db_type(self, db_url: str) -> str:
        url = db_url.lower()
        if 'mssql' in url: return 'mssql'
        if 'postgres' in url: return 'postgresql'
        if 'mysql' in url: return 'mysql'
        return 'sqlite'

    def process(self, command_data):
        prompt = command_data.get("englishPrompt") or command_data.get("rawPrompt")
        print(f"[VannaAgent] SQL üretimi başlatıldı: {prompt}")
        
        try:
            generated_sql = self.generate_sql(prompt)
            command_data["generatedSql"] = generated_sql
            print(f"[VannaAgent] SQL Üretildi: {generated_sql}")
            
        except Exception as e:
            print(f"[VannaAgent] Hata: {str(e)}")
            command_data["generatedSql"] = None
            command_data["error"] = str(e)
            
        return command_data

# Instance oluştur
vn = AIDBVanna(config={'model': 'qwen2.5-coder'})