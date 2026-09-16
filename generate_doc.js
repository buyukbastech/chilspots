const fs = require('fs');
const docx = require('docx');
const sizeOf = require('image-size');
const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } = docx;

// Image paths
const imageDir = "C:\\Users\\Ahmet Enes Büyükbaş\\.gemini\\antigravity-ide\\brain\\b2bfd845-f11e-4f69-91d6-8d1c9e15c651\\.user_uploaded";
const images = [
    { path: `${imageDir}\\media_1789574919849.png`, desc: "İşletme Profil Düzenleme ve Vibe Seçimi Ekranı" },
    { path: `${imageDir}\\media_1789574620371.png`, desc: "İşletme Adresi ve Lokasyon Seçimi Ekranı" },
    { path: `${imageDir}\\media_1789574023885.png`, desc: "İşletme Dil Seçenekleri (İngilizce/Türkçe)" },
    { path: `${imageDir}\\media_1789573927758.png`, desc: "Giriş ve Profil Ayarları" }
];

const children = [
    new Paragraph({
        text: "ChillSpot AI - Web Projesi Tüm Detaylar ve Görseller",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
        children: [new TextRun({ text: "1. Proje Amacı ve Konsept", bold: true, size: 28 })],
        spacing: { before: 400, after: 200 }
    }),
    new Paragraph({
        text: "ChillSpot AI, kullanıcıların anlık ruh hallerine ve 'Vibe'larına göre en uygun mekanları keşfetmelerini sağlayan yenilikçi bir platformdur. Kullanıcılar 'Rahat', 'Eğlence', 'Melankolik', 'Nostaljik' gibi modlarını seçerek, harita üzerinde (Leaflet entegrasyonu ile) kendi ruh hallerine uyan kafeleri, restoranları ve etkinlik alanlarını bulabilirler.",
        spacing: { after: 200 }
    }),
    new Paragraph({
        children: [new TextRun({ text: "2. Hedef Kitle ve Kullanım Akışı", bold: true, size: 28 })],
        spacing: { before: 200, after: 200 }
    }),
    new Paragraph({
        text: "Hedef kitle, klasik mekan arama (örneğin sadece lokasyon ve menü) sınırlarının ötesine geçerek tamamen atmosfere odaklanan kullanıcılardır. ChillSpot AI'da iki tür kullanıcı bulunur:",
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: "- Normal Kullanıcılar (Kaşifler): Sistem onlara profil fotoğrafı, 'Yeni Kaşif' unvanı, favori mekan kaydetme ve modlarına göre AI önerileri sunar.",
        bullet: { level: 0 }
    }),
    new Paragraph({
        text: "- İşletme Sahipleri: Kendi işletmelerini sisteme kaydedebilir, mekan tarzlarını (Örn: Rahat/Chill, Sakin, Enerjik) belirtebilir, logo ve mekan fotoğrafları yükleyebilirler.",
        bullet: { level: 0 },
        spacing: { after: 200 }
    }),
    new Paragraph({
        children: [new TextRun({ text: "3. Öne Çıkan Özellikler", bold: true, size: 28 })],
        spacing: { before: 200, after: 200 }
    }),
    new Paragraph({
        text: "- Supabase Veritabanı ve Auth: Güvenli kullanıcı girişi ve gerçek zamanlı veritabanı.\n- Çift Dil Desteği (i18n): Sistem dinamik olarak Türkçe ve İngilizce dillerini destekler. İşletme girişinden mod seçimine kadar her şey seçilen dile anında uyum sağlar.\n- Vibe Radarı: Yapay zeka ile kullanıcı modlarını mekanın atmosfer verileriyle eşleştirir.\n- Karanlık Temalı Şık Arayüz: Neon hatlar, glassmorphism (cam tasarımı) ve koyu tema kullanılarak şık ve modern bir arayüz geliştirilmiştir.",
        spacing: { after: 200 }
    }),
    new Paragraph({
        children: [new TextRun({ text: "4. Arayüz Görselleri ve Sayfa Detayları", bold: true, size: 28 })],
        spacing: { before: 400, after: 400 }
    })
];

// Add images
for (const img of images) {
    if (fs.existsSync(img.path)) {
        children.push(new Paragraph({
            children: [new TextRun({ text: img.desc, bold: true, size: 24 })],
            spacing: { before: 300, after: 200 }
        }));

        const dimensions = sizeOf(img.path);
        const maxWidth = 550;
        let width = dimensions.width;
        let height = dimensions.height;

        if (width > maxWidth) {
            const ratio = maxWidth / width;
            width = maxWidth;
            height = height * ratio;
        }

        children.push(new Paragraph({
            children: [
                new ImageRun({
                    data: fs.readFileSync(img.path),
                    transformation: {
                        width: width,
                        height: height
                    },
                    type: "png"
                })
            ],
            alignment: AlignmentType.CENTER,
        }));
    }
}

const doc = new Document({
    sections: [{
        properties: {},
        children: children
    }]
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync("ChillSpot_AI_Tüm_Detaylar.docx", buffer);
    console.log("Document generated successfully!");
}).catch((err) => {
    console.error("Error creating document", err);
});
