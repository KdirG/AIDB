import pandas as pd

class FormattingAgent:
    def __init__(self, model_engine):
        self.engine = model_engine

    def format_output(self, user_query, raw_data):
        # Veriyi okunabilir bir string'e çevirelim
        data_to_show = ""
        
        if isinstance(raw_data, pd.DataFrame):
            if raw_data.empty:
                return "I couldn't find any data matching your request."
            # DataFrame'i modelin anlayacağı küçük bir tablo metnine çevir
            data_to_show = raw_data.to_string(index=False)
        else:
            data_to_show = str(raw_data)

        # Skaler  mı yoksa tablo mu kontrolü
        if isinstance(raw_data, (int, float)) or (isinstance(raw_data, pd.DataFrame) and raw_data.size == 1):
            prompt = (
                f"User asked: '{user_query}'\n"
                f"Database result: {data_to_show}\n"
                f"Instruction: Create a natural sentence answering the user. "
                f"The EXACT value is: {data_to_show}. Use this value."
            )
        else:
            prompt = (
                f"User asked: '{user_query}'\n"
                f"Database output:\n{data_to_show}\n"
                f"Instruction: Based on this data, write a short, helpful summary sentence in English. "
                "Example: 'I found the top 5 customers who spent the most.'"
            )

        response = self.engine.generate_response(prompt)
        return response