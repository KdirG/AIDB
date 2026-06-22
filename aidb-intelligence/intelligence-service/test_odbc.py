def classify_sql(sql):
    sql_upper = sql.strip().upper()
    if any(w in sql_upper for w in ["DELETE ", "UPDATE ", "INSERT ", "TRUNCATE "]):
        return "DML"
    if any(w in sql_upper for w in ["DROP ", "CREATE ", "ALTER "]):
        return "DDL"
    if sql_upper.startswith("SELECT") or sql_upper.startswith("WITH"):
        return "DQL"
    return "UNKNOWN"

print(classify_sql("SELECT TOP 1000 Id, Ad, Soyad, Sehir, Ulke, Telefon FROM Musteri;"))
