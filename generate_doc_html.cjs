const fs = require('fs');
const path = require('path');

const imageDir = "C:\\Users\\Ahmet Enes Büyükbaş\\.gemini\\antigravity-ide\\brain\\b2bfd845-f11e-4f69-91d6-8d1c9e15c651\\.user_uploaded";
const images = [
    { path: `${imageDir}\\media_1789574919849.png`, desc: "İşletme Profil Düzenleme ve Vibe Seçimi Ekranı" },
    { path: `${imageDir}\\media_1789574620371.png`, desc: "İşletme Adresi ve Lokasyon Seçimi Ekranı" },
    { path: `${imageDir}\\media_1789574023885.png`, desc: "İşletme Dil Seçenekleri (İngilizce/Türkçe)" },
    { path: `${imageDir}\\media_1789573927758.png`, desc: "Giriş ve Profil Ayarları" }
];

let html = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
    <meta charset="utf-8">
    <title>ChillSpot AI Proje Detaylari</title>
    <style>
        body { font-family: 'Calibri', sans-serif; line-height: 1.5; color: #333; }
        h1 { color: #2c3e50; text-align: center; border-bottom: 2px solid #2c3e50; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        p { margin-bottom: 10px; font-size: 14pt; }
        ul { font-size: 14pt; }
        .img-container { text-align: center; margin: 20px 0; }
        img { max-width: 600px; border: 1px solid #ccc; box-shadow: 2px 2px 5px rgba(0,0,0,0.1); }
        .desc { font-weight: bold; margin-bottom: 5px; font-size: 12pt; color: #555; }
    </style>
</head>
<body>
    <h1>ChillSpot AI - Web Projesi Tüm Detaylar ve Görseller</h1>
    
    <h2>1. Proje Amacı ve Konsept</h2>
    <p>ChillSpot AI, kullanıcıların anlık ruh hallerine ve 'Vibe'larına göre en uygun mekanları keşfetmelerini sağlayan yenilikçi bir platformdur. Kullanıcılar 'Rahat', 'Eğlence', 'Melankolik', 'Nostaljik' gibi modlarını seçerek, harita üzerinde kendi ruh hallerine uyan kafeleri, restoranları ve etkinlik alanlarını bulabilirler.</p>
    
    <h2>2. Hedef Kitle ve Kullanım Akışı</h2>
    <p>Hedef kitle, klasik mekan arama (örneğin sadece lokasyon ve menü) sınırlarının ötesine geçerek tamamen atmosfere odaklanan kullanıcılardır. ChillSpot AI'da iki tür kullanıcı bulunur:</p>
    <ul>
        <li><b>Normal Kullanıcılar (Kaşifler):</b> Sistem onlara profil fotoğrafı, 'Yeni Kaşif' unvanı, favori mekan kaydetme ve modlarına göre AI önerileri sunar.</li>
        <li><b>İşletme Sahipleri:</b> Kendi işletmelerini sisteme kaydedebilir, mekan tarzlarını (Örn: Rahat/Chill, Sakin, Enerjik) belirtebilir, logo ve mekan fotoğrafları yükleyebilirler.</li>
    </ul>

    <h2>3. Öne Çıkan Özellikler</h2>
    <ul>
        <li><b>Supabase Veritabanı ve Auth:</b> Güvenli kullanıcı girişi ve gerçek zamanlı veritabanı altyapısı.</li>
        <li><b>Çift Dil Desteği (i18n):</b> Sistem dinamik olarak Türkçe ve İngilizce dillerini destekler. İşletme girişinden mod seçimine kadar her şey seçilen dile anında uyum sağlar.</li>
        <li><b>Vibe Radarı:</b> Yapay zeka ile kullanıcı modlarını mekanın atmosfer verileriyle eşleştirir.</li>
        <li><b>Karanlık Temalı Şık Arayüz:</b> Neon hatlar, glassmorphism (cam tasarımı) ve koyu tema kullanılarak şık ve modern bir arayüz geliştirilmiştir.</li>
    </ul>

    <h2>4. Arayüz Görselleri ve Sayfa Detayları</h2>
`;

images.forEach(img => {
    if (fs.existsSync(img.path)) {
        const ext = path.extname(img.path).substring(1);
        const base64 = fs.readFileSync(img.path, 'base64');
        const dataUri = `data:image/${ext};base64,${base64}`;
        
        html += `
        <div class="img-container">
            <div class="desc">${img.desc}</div>
            <img src="${dataUri}" alt="${img.desc}" />
        </div>
        `;
    }
});

html += `
</body>
</html>
`;

fs.writeFileSync("ChillSpot_AI_Tasarim_Ve_Detaylar.doc", html, 'utf8');
console.log("ChillSpot_AI_Tasarim_Ve_Detaylar.doc created successfully.");
