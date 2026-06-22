# 3. BULGULAR

Bu bölümde, AIDB (Yapay Zeka Destekli Veritabanı Yönetim Sistemi) projesinin geliştirme sürecinin ardından elde edilen platform yetenekleri, modüller arası asenkron iletişim sonuçları ve kullanıcı arayüzü fonksiyonları değerlendirilmektedir. Sistem; kimlik doğrulama, yönetici denetimleri, veritabanı kayıt yönetimi, doğal dil (NLP) ile veri sorgulama, gerçek zamanlı bilgi akışı (SSE - Server Sent Events) ve dinamik analitik görselleştirme açılarından test edilmiştir. Bulgular, modern "Elegant Drama" web/masaüstü arayüzünden (Next.js & Tauri) alınan uygulama içi ekran görüntüleri ile desteklenmiştir.

## 3.1. Sistem Fonksiyonlarının Gerçekleştirilmesi

### 3.1.1. Kullanıcı Kayıt ve Güvenli Giriş İşlemleri
Sistem giriş kapısı, veritabanı güvenliğini sağlamak amacıyla tamamen kapalı (private) bir mimaride çalışmaktadır. Uygulamaya girişte şifrelenmiş kimlik denetimi yapılmaktadır. Java Spring Security üzerinden başarıyla kimlik doğrulayan kullanıcılara üretilen JWT (JSON Web Token), istemci tarafında şifreli depolama alanlarına yazılarak API iletişiminde anahtar olarak kullanılır.

**Bulgular:**
* JWT tabanlı oturum yönetimi sorunsuz çalışmakta, yetkisiz veya oturum süresi dolmuş kullanıcıların API uç noktalarına erişimi arka planda (Interceptor) engellenmektedir.
* Tasarım ekosistemine uygun olarak, yüksek görsel hiyerarşi barındıran brutalist konsept (Tailwind & Radix UI formları) kullanıcıya modern ve güven veren bir giriş deneyimi sunmaktadır.

> *[Şekil 3.1: Sisteme Giriş (Login) Ekranı]*
> *(Buraya giriş ekranının görüntüsü eklenecektir)*

### 3.1.2. Yönetici (Admin) Paneli ve Veritabanı Bağlantı Yönetimi
Sistemin beyni olan yönetici (Admin) hesapları, sahip oldukları özel menü bağlantısı (Admin Panel) üzerinden dışarıdaki MSSQL hedef veritabanlarını sisteme tanıtabilmektedir. Yeni veritabanları (Host, Kullanıcı Adı, IP adresi ve Güvenlik Parametreleri) modal pencereleri üzerinden şifrelenerek kayıt altına alınmaktadır.

**Bulgular:**
* Dinamik veritabanı kayıtları, Orchestrator üzerinden Intelligence (Python) modülüne hatasız bir Connection String (Örn: `mssql+pyodbc://...`) olarak derlenebilmiştir.
* Rol bazlı erişim kontrolü (RBAC) başarılıdır; yetki atanmamış standart kullanıcıların hem Admin paneline hem de kendilerine atanmamış veritabanlarına girmesi durdurulmuştur.

> *[Şekil 3.2: Yönetici Paneli ve Yeni Veritabanı Ekleme (Database Modal) Çıktısı Ekranı]*
> *(Buraya admin-panel.tsx veya database-modal.tsx ekranının görüntüsü eklenecektir)*

### 3.1.3. Doğal Dil ile Akıllı Sorgulama (NLP to SQL) Arabirimi
Uygulamanın merkezindeki yapay zeka servisini tetikleyen "Chat Input" araçları üzerinden kullanıcılar, doğal Türkçe veya İngilizce dil kullanarak (Örn: "Bu haftanın en çok işlem gören 10 verisini getir") komut girebilmektedir. Kullanıcılardan teknik SQL syntax bilgisi beklenmez.

**Bulgular:**
* Redis Pub/Sub üzerinden Python Worker'daki Ajan yapılarına (NLP Agents) giden direktifler, yüksek doğrulukla, hedef veritabanı şeması gözetilerek (DDL/DML algılanarak) güvenli T-SQL paketlerine (batch) dönüştürülmüştür.
* Eğer kullanıcı, veriyi sadece listelemek (SELECT) yerine veriyi değiştirecek, bozacak (DROP, DELETE, UPDATE) zararlı bir NLP komutu verirse; sistem kullanıcının "canModify" yetkisini kontrol ederek işleme onay istemekte veya yetkisiz işlemi doğrudan reddetmektedir (Sistem güvenliği sağlandı).

> *[Şekil 3.3: Chat Arayüzünden Girilen Talebin Sistem Tarafından Algılanması ve SQL Koduna Dönüştürülme Ekranı]*
> *(Buraya chat-input ve chat-message ekranlarının bulunduğu kısım eklenecektir)*

### 3.1.4. Dinamik Veri Tabloları ve Analitik Raporlama
Akıllı sorgulama işleminden sonra asenkron işçiden (Python) dönen analiz edilmiş veriler, JSON objeleri olarak Frontend veri masasına (Data Table) gönderilir. Yalnızca salt harfler/sayılar göstermek yerine, verilerin içgörüsünü (insight) ortaya çıkaran Metrics Bar ve Analytics Panel araçları devreye girer.

**Bulgular:**
* Yapılan filtreleme verileri üzerinden saniyeler içinde "Recharts / Plotly" modülleri kullanılarak grafik arayüzleri çizdirilmiştir.
* Sonuçların arayüzde paginasyonlu (sayfalamalı) tabloda gösterilmesi sayesinde frontend üzerinde aşırı RAM şişmesi veya çökme sorunları yaşanmamıştır.  

> *[Şekil 3.4: SQL Sorgularına Verilen Cevapların Veri Tablosu ve Otomatik Çizdirilen Grafikleri (Analytics) Ekranı]*
> *(Buraya data-table.tsx ve analytics-panel.tsx öğelerinin olduğu dashboard görüntüsü eklenecektir)*

### 3.1.5. Canlı Kod Yürütme ve SSE Terminali (SQL Terminal)
Kullanıcının direkt yazdığı veya yapay zekanın ürettiği yüksek maliyetli/uzun T-SQL kodları hedefe işlenirken, tarayıcıda veya arayüzde "yükleniyor..." ekranında sınırsızca beklenmemesi için tasarlanan Canlı SQL Terminali işlevleri test edilmiştir.

**Bulgular:**
* Server-Sent Events (`SseEmitter`) protokolü kesintisiz olarak aktifleşmiş, Backend den dönen "Trigger Ayrıştırıldı...", "Tablo Güncellendi..." gibi durum uyarıları masaüstü yazılımlarındaki entegre terminaller kadar akıcı bir şekilde ekrana (sql-terminal.tsx) yazdırılabilmiştir.
* HTTP Timeout (İstek zaman aşımı) süresine takılabilecek olan devasa boyutlu yığın operasyonlarının, API'yi bloklamadan (Asenkron kuyruk yönetimi) başarılı bir hata ayıklama (Try/Catch) süreci sunduğu gözlemlenmiştir.

> *[Şekil 3.5: Asenkron Veritabanı İşlemlerinin İlerleme (Progress) Durumunu Belirten SSE Terminal Ekranı]*
> *(Buraya sql-terminal.tsx öğesini ve logları barındıran görüntü eklenecektir)*

### 3.1.6. Sistem Navigasyonu ve Tema/Görünüm Optimizasyonu
Masaüstü (Tauri) vizyonunu sağlayan hızlı navigasyon elemanları test edilmiş ve sistemin ana iskeleti olan Sidebar (Yan menü) geçişleri, veritabanları arası sekmeli geçişler (Tabs/Routing) ile kontrol edilmiştir.

**Bulgular:**
* Next.js "App Router" yapısı sayesinde farklı veritabanı ortamları veya menüler arası geçişlerde uygulama sayfası yenilenmeden, komponentler arası pürüzsüz geçiş yapılabilmiştir (Single Page Application akıcılığı).
* Sade, kalın yazı tiplerinin ve dramatik boşlukların kullanıldığı kullanıcı deneyimi odaklı tasarım, veri okumayı yormayan "Elegant Drama" standartlarını tutturmuştur. Mode Toggle entegrasyonu başarıyla modüle edilmiştir.

> *[Şekil 3.6: Ortam Değiştirme (Sidebar) ve Genel Bildirim Araçlarının Bulunduğu Sistem Çerçevesi]*
> *(Buraya kenar menüsünün (sidebar) ve genel dashboard'un dış çerçevesinin olduğu geniş bir ekran görüntüsü eklenecektir)*

## 3.2. Tasarım Modelinin Genel Değerlendirmesi
Geliştirilen uygulamanın çıktıları incelendiğinde; AIDB projesi klasik bir Veritabanı yönetim aracı (IDE) mantığından çıkarak "Yapay Zeka (NLP) Destekli Akıllı Veritabanı Asistanı" yapısını başarıyla kurmuştur. Geleneksel SQL araçlarındaki kaba tasarım ve yüksek teknik yetkinlik şartları; burada yapay zekanın NLP ajanlarına devredilerek modern, interaktif ve gerçek zamanlı geri bildirim ağına (SSE) sahip yeni nesil bir veritabanı deneyimine dönüştürülmüştür.
