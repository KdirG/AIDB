import ollama
import re

class RefinerAgent:
    def __init__(self, model_name='qwen2.5-coder:latest'):
        self.model_name = model_name

    def process(self, data):
        # Akıllı mod istenmemişse ve bir SQL zaten varsa atla
        if not data.get("useSmartMode") and data.get("generatedSql"):
            return data

        print(f"[RefinerAgent] Stratejik Planlama ve SQL İnşası Başlatıldı...")
        
        user_query = data.get("translatedPrompt") or data.get("englishPrompt")
        relationship_map = data.get("dbSchema", "Schema not provided")
        
        # --- GÜÇLENDİRİLMİŞ TALİMATLAR ---
        system_instructions = f"""You are a Senior SQL Solutions Architect. Your goal is to draft a logical execution plan and generate the FINAL MSSQL query.

        RELATIONSHIP MAP (USE ONLY THESE NAMES):
        {relationship_map}

        STRATEGIC GUIDELINES:
        1. DML SAFETY: For DELETE, UPDATE, or INSERT, do NOT use CTEs (WITH clauses). Use direct SQL statements.
        2. FOREIGN KEY AWARENESS: When deleting, delete from CHILD tables first, then PARENT tables.
        3. DQL STRUCTURE: For complex SELECTs, use CTEs (WITH clauses).
        4. MS SQL SERVER: Use [Table].[Column] syntax. Use TOP instead of LIMIT.
        5. OUTPUT FORMAT: 
           - Step 1: Technical execution plan.
           - Step 2: The SQL code block inside ```sql ```.
        """

        try:
            full_prompt = f"""
            USER QUERY: {user_query}
            Perform these steps:
            1. Create a technical plan.
            2. Generate the FINAL MSSQL QUERY in a ```sql ``` block.
            """
            
            response = ollama.generate(
                model=self.model_name, 
                system=system_instructions,
                prompt=full_prompt,
                options={"temperature": 0.1}
            )
            
            full_text = response['response'].strip()
            
            # 🔍 1. ADIM: GENİŞLETİLMİŞ REGEX 
            # (SELECT|DELETE|UPDATE|INSERT|CREATE|DROP|ALTER|WITH) hepsini yakalar
            sql_match = re.search(r'```sql\s*(.*?)\s*```', full_text, re.DOTALL | re.IGNORECASE)
            
            if sql_match:
                clean_sql = sql_match.group(1).strip()
            else:
                # Blok yoksa anahtar kelimeden itibaren cımbızla çek
                print("[RefinerAgent] Kod bloğu bulunamadı, anahtar kelime taranıyor...")
                manual_match = re.search(r'(SELECT|DELETE|UPDATE|INSERT|CREATE|DROP|ALTER|WITH).*', full_text, re.DOTALL | re.IGNORECASE)
                clean_sql = manual_match.group(0).strip() if manual_match else full_text

            # 🧹 2. ADIM: Dashboard'ı Bozan Metinleri Temizle
            # Step 1, Step 2, Plan gibi ifadeleri SQL'in içinden ayıklar
            clean_sql = re.sub(r'Step \d+:.*', '', clean_sql, flags=re.IGNORECASE)
            clean_sql = re.sub(r'Technical Execution Plan:.*', '', clean_sql, flags=re.IGNORECASE)
            clean_sql = re.sub(r'###.*', '', clean_sql)
            clean_sql = re.sub(r'```.*', '', clean_sql)
            
            # Son dokunuş temizlik
            clean_sql = clean_sql.strip()

            print(f"DEBUG: [RefinerAgent] Üretilen SQL -> {clean_sql}")
            
            data["generatedSql"] = clean_sql
            data["executionPlan"] = full_text.split("```")[0].strip()
            data["status"] = "SUCCESS"
            print(f"[RefinerAgent] SQL Başarıyla Rafine Edildi.")
            
        except Exception as e:
            print(f"[RefinerAgent] Hata: {str(e)}")
            data["status"] = "REFINER_ERROR"
            
        return data