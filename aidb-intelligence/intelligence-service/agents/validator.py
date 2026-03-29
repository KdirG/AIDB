import re

class ValidatorAgent:
    def __init__(self):
        # Varsayılan yasaklı kelimeler (Java'dan gelmezse bunları kullanır)
        self.dangerous_keywords = ["DROP", "TRUNCATE", "ALTER", "GRANT", "REVOKE", "SHUTDOWN"]
        print("[ValidatorAgent] Güvenlik muhafızı göreve hazır.")

    def process(self, command_data):
        sql_query = command_data.get("generatedSql", "")
        # Java'dan gelen kısıtlamalar varsa onları da ekleyelim
        java_restricted = command_data.get("restrictedTables", [])
        user_role = command_data.get("userRole", "USER")

        print(f"[ValidatorAgent] Denetim başlatılıyor... (User: {user_role})")

        if not sql_query:
            command_data["isValid"] = False
            command_data["validationMessage"] = "Sorgu boş üretildi."
            return command_data

        # 1. ADIM: Regex ile SQL'i ayıkla (Senin yazdığın mantık)
        # Modelin kurduğu cümleler arasından gerçek SQL komutunu bulur
        match = re.search(r"(SELECT|WITH|SHOW|DESCRIBE|UPDATE|INSERT|DELETE).*", sql_query, re.IGNORECASE | re.DOTALL)
        
        if match:
            clean_sql = match.group(0).strip()
            upper_sql = clean_sql.upper()

            # 2. ADIM: Tehlikeli Kelime Kontrolü
            for danger in self.dangerous_keywords:
                if danger in upper_sql:
                    command_data["isValid"] = False
                    command_data["validationMessage"] = f"Güvenlik İhlali: '{danger}' komutu yasaklıdır."
                    print(f"[ValidatorAgent] REDDEDİLDİ: {danger} bulundu.")
                    return command_data

            # 3. ADIM: Tablo Kısıtlaması (Java'dan gelen restrictedTables)
            if user_role != "ADMIN" and java_restricted:
                for table in java_restricted:
                    if table.upper() in upper_sql:
                        command_data["isValid"] = False
                        command_data["validationMessage"] = f"Yetki Hatası: '{table}' tablosuna erişiminiz yok."
                        return command_data

            # Her şey yolunda
            command_data["isValid"] = True
            command_data["generatedSql"] = clean_sql # Temizlenmiş SQL'i geri ver
            command_data["validationMessage"] = "Güvenli"
            print("[ValidatorAgent] Onay verildi.")
            
        else:
            command_data["isValid"] = False
            command_data["validationMessage"] = "Metin içerisinde geçerli bir SQL komutu bulunamadı."

        return command_data