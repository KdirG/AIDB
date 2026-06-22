import torch
import re
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

device = torch.device("cpu")

class TranslatorAgent: # İsmini mimariye uygun güncelledik
    def __init__(self):
        self.tr_en_model_name = "Helsinki-NLP/opus-mt-tc-big-tr-en"
        print(f"[{device}] Çeviri modeli yükleniyor...")
        self.tr_en_tokenizer = AutoTokenizer.from_pretrained(self.tr_en_model_name)
        self.tr_en_model = AutoModelForSeq2SeqLM.from_pretrained(self.tr_en_model_name).to(device)

    def _extract_table_hint(self, text):
        pattern = r"(\w+)\s+tablo(sundaki|sunu|sunda|su|sundan|suna)"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            table_name = match.group(1)
            return f" Use the table named '{table_name}'."
        return ""

    def process(self, command_data):
        """Chain of Responsibility halkası"""
        raw_text = command_data.get("rawPrompt", "")
        print(f"[Translator] Çeviri başlatılıyor: {raw_text}")
        
        # Senin mevcut çeviri mantığın
        inputs = self.tr_en_tokenizer(raw_text, return_tensors="pt", padding=True).to(device)
        outputs = self.tr_en_model.generate(**inputs)
        translated = self.tr_en_tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Helsinki-NLP modeli bilinmeyen isimlerde (Örn: Mertcan) bazen HTML tag'leri (örn: <a href="400">) üretebilir.
        # Bu tarz halüsinasyonları temizliyoruz.
        translated = re.sub(r'<[^>]+>', '', translated)
        translated = re.sub(r'\d+">', '', translated)
        translated = translated.replace('">', '')
        
        hint = self._extract_table_hint(raw_text)
        final_prompt = translated + hint
        
        # Paketi güncelle ve bir sonraki halkaya iletmek üzere dön
        command_data["englishPrompt"] = final_prompt
        print(f"[Translator] Çeviri tamamlandı: {final_prompt}")
        return command_data