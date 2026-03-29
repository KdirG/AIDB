import os
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, text, desc
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

Base = declarative_base()

class QueryHistory(Base):
    __tablename__ = 'query_history'
    id = Column(Integer, primary_key=True)
    prompt = Column(String)
    sql_query = Column(String)
    explanation = Column(String)
    is_success = Column(Boolean)
    error_message = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

class HistoryAgent:
    def __init__(self, db_path="history.db"):
        # SQLite bağlantısını kurar ve tablo yoksa oluşturur
        self.engine = create_engine(f"sqlite:///{db_path}")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)

    def log_query(self, prompt, sql, exp, success, error=None):
        """Sorguyu SQLite'a kaydeder ve 'çıldıırı' gibi çeviri hatalarını düzeltir."""
        session = self.Session()
        try:
            # Çeviri motoru komikliklerini veritabanına girmeden ayıklıyoruz :D
            clean_exp = exp.replace("Çıldıırı", "Çalıştırıldı") if exp else exp
            
            new_entry = QueryHistory(
                prompt=prompt,
                sql_query=sql,
                explanation=clean_exp,
                is_success=success,
                error_message=str(error) if error else None
            )
            session.add(new_entry)
            session.commit()
            print(f"[HistoryAgent]: Sorgu kaydedildi. Başarı: {success}")
        except Exception as e:
            print(f"[HistoryAgent] Kayıt Hatası: {e}")
        finally:
            session.close()

    def get_all_history(self):
        """Frontend için tüm geçmişi en yeni en üstte olacak şekilde döndürür."""
        session = self.Session()
        try:
            # Tarihe göre tersten sıralayarak tüm kayıtları getirir
            results = session.query(QueryHistory).order_by(desc(QueryHistory.timestamp)).all()
            return [
                {
                    "id": r.id,
                    "prompt": r.prompt,
                    "sql": r.sql_query,
                    "explanation": r.explanation,
                    "success": r.is_success,
                    "time": r.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                } for r in results
            ]
        except Exception as e:
            print(f"[HistoryAgent] Geçmiş Çekme Hatası: {e}")
            return []
        finally:
            session.close()

    def get_training_data(self):
        """Sadece başarılı olan sorguları 'Golden Shot' eğitimi için döndürür."""
        session = self.Session()
        try:
            # Sistem yanlışları öğrenmesin diye sadece başarılılar (is_success=True)
            results = session.query(QueryHistory).filter(QueryHistory.is_success == True).all()
            return [{"prompt": r.prompt, "sql": r.sql_query} for r in results]
        finally:
            session.close()

# Singleton instance - Projenin her yerinden bu obje üzerinden işlem yapılır
history_logger = HistoryAgent()