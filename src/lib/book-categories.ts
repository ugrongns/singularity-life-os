export const BOOK_CATEGORIES = [
  "Aile & İlişkiler",
  "Antika & Koleksiyon Ürünleri",
  "Bahçecilik",
  "Beden, Zihin & Ruh",
  "Bilgisayar",
  "Bilim",
  "Biyografi & Otobiyografi",
  "Çizgi Roman & Grafik Roman",
  "Çocuk Kurgu (Juvenile Fiction)",
  "Dil Bilimleri & Disiplinleri",
  "Din",
  "Doğa",
  "Edebi Derlemeler",
  "Edebiyat Eleştirisi",
  "Eğitim",
  "El Sanatları & Hobiler",
  "Ev & Yaşam",
  "Evcil Hayvanlar",
  "Felsefe",
  "Fotoğrafçılık",
  "Genç Yetişkin Kurgu (Young Adult Fiction)",
  "Gerçek Suç (True Crime)",
  "Hukuk",
  "İnciller / Kutsal Kitaplar",
  "İş & Ekonomi",
  "Kişisel Gelişim",
  "Kurgu (Fiction)",
  "Matematik",
  "Mimarlık",
  "Mizah",
  "Müzik",
  "Oyunlar & Aktiviteler",
  "Psikoloji",
  "Referans / Başvuru Kitapları",
  "Sağlık & Fitness",
  "Sahne Sanatları",
  "Sanat",
  "Seyahat",
  "Sınav Hazırlık / Çalışma Kaynakları",
  "Siyaset Bilimi",
  "Sosyal Bilimler",
  "Spor & Rekreasyon",
  "Şiir",
  "Tarih",
  "Tasarım",
  "Teknoloji & Mühendislik",
  "Tıp",
  "Tiyatro / Drama",
  "Ulaşım",
  "Yabancı Dil Çalışmaları",
  "Yemek & Mutfak"
];

// İngilizce ve Genel Veritabanı Kategorilerini Türkçe Standart Kategorilere Eşleme Sözlüğü
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  // Psikoloji & Zihin
  'psychology': 'Psikoloji',
  'psychiatry': 'Psikoloji',
  'mental health': 'Psikoloji',
  'trauma': 'Psikoloji',
  'psychoanalysis': 'Psikoloji',
  'psychotherapy': 'Psikoloji',
  'neuroscience': 'Psikoloji',
  'behavioral': 'Psikoloji',
  'cognitive': 'Psikoloji',
  'counseling': 'Psikoloji',
  'psikoloji': 'Psikoloji',
  'psikiyatri': 'Psikoloji',

  // Kişisel Gelişim
  'self-help': 'Kişisel Gelişim',
  'personal growth': 'Kişisel Gelişim',
  'personal development': 'Kişisel Gelişim',
  'motivation': 'Kişisel Gelişim',
  'habits': 'Kişisel Gelişim',
  'success': 'Kişisel Gelişim',
  'leadership': 'Kişisel Gelişim',
  'productivity': 'Kişisel Gelişim',
  'time management': 'Kişisel Gelişim',

  // Beden & Ruh
  'body, mind & spirit': 'Beden, Zihin & Ruh',
  'body mind & spirit': 'Beden, Zihin & Ruh',
  'mindfulness': 'Beden, Zihin & Ruh',
  'spirituality': 'Beden, Zihin & Ruh',
  'meditation': 'Beden, Zihin & Ruh',
  'yoga': 'Beden, Zihin & Ruh',
  'astrology': 'Beden, Zihin & Ruh',

  // Kurgu & Edebiyat
  'fiction': 'Kurgu (Fiction)',
  'literary fiction': 'Kurgu (Fiction)',
  'novel': 'Kurgu (Fiction)',
  'literature': 'Kurgu (Fiction)',
  'roman': 'Kurgu (Fiction)',
  'öykü': 'Kurgu (Fiction)',
  'hikaye': 'Kurgu (Fiction)',
  'edebiyat': 'Kurgu (Fiction)',
  'classics': 'Kurgu (Fiction)',
  'fantasy': 'Kurgu (Fiction)',
  'science fiction': 'Kurgu (Fiction)',
  'thriller': 'Kurgu (Fiction)',
  'mystery': 'Kurgu (Fiction)',
  'suspense': 'Kurgu (Fiction)',
  'historical fiction': 'Kurgu (Fiction)',
  'juvenile fiction': 'Çocuk Kurgu (Juvenile Fiction)',
  'young adult fiction': 'Genç Yetişkin Kurgu (Young Adult Fiction)',
  'children': 'Çocuk Kurgu (Juvenile Fiction)',
  'young adult': 'Genç Yetişkin Kurgu (Young Adult Fiction)',

  // İş & Finans & Ekonomi
  'business & economics': 'İş & Ekonomi',
  'business': 'İş & Ekonomi',
  'economics': 'İş & Ekonomi',
  'finance': 'İş & Ekonomi',
  'investing': 'İş & Ekonomi',
  'management': 'İş & Ekonomi',
  'marketing': 'İş & Ekonomi',
  'entrepreneurship': 'İş & Ekonomi',
  'accounting': 'İş & Ekonomi',
  'ekonomi': 'İş & Ekonomi',
  'finans': 'İş & Ekonomi',

  // Bilim & Bilgisayar & Teknoloji
  'computers': 'Bilgisayar',
  'computer science': 'Bilgisayar',
  'software': 'Bilgisayar',
  'programming': 'Bilgisayar',
  'web development': 'Bilgisayar',
  'data science': 'Bilgisayar',
  'artificial intelligence': 'Bilgisayar',
  'bilgisayar': 'Bilgisayar',
  'yazılım': 'Bilgisayar',
  'technology & engineering': 'Teknoloji & Mühendislik',
  'technology': 'Teknoloji & Mühendislik',
  'engineering': 'Teknoloji & Mühendislik',
  'science': 'Bilim',
  'physics': 'Bilim',
  'chemistry': 'Bilim',
  'biology': 'Bilim',
  'astronomy': 'Bilim',
  'bilim': 'Bilim',
  'matematik': 'Matematik',
  'mathematics': 'Matematik',

  // Felsefe & Tarih
  'philosophy': 'Felsefe',
  'felsefe': 'Felsefe',
  'ethics': 'Felsefe',
  'history': 'Tarih',
  'tarih': 'Tarih',
  'world history': 'Tarih',
  'middle east history': 'Tarih',
  'ancient history': 'Tarih',
  'archaeology': 'Tarih',
  'arkeoloji': 'Tarih',

  // Tıp & Sağlık
  'medical': 'Tıp',
  'medicine': 'Tıp',
  'tıp': 'Tıp',
  'health & fitness': 'Sağlık & Fitness',
  'health': 'Sağlık & Fitness',
  'fitness': 'Sağlık & Fitness',
  'diet': 'Sağlık & Fitness',
  'nutrition': 'Sağlık & Fitness',
  'sağlık': 'Sağlık & Fitness',
  'beslenme': 'Sağlık & Fitness',

  // Sosyal Bilimler & Siyaset
  'social science': 'Sosyal Bilimler',
  'sociology': 'Sosyal Bilimler',
  'anthropology': 'Sosyal Bilimler',
  'sosyoloji': 'Sosyal Bilimler',
  'sosyal bilimler': 'Sosyal Bilimler',
  'political science': 'Siyaset Bilimi',
  'politics': 'Siyaset Bilimi',
  'siyaset': 'Siyaset Bilimi',
  'politika': 'Siyaset Bilimi',
  'law': 'Hukuk',
  'hukuk': 'Hukuk',

  // Aile & Eğitim
  'family & relationships': 'Aile & İlişkiler',
  'family': 'Aile & İlişkiler',
  'parenting': 'Aile & İlişkiler',
  'relationships': 'Aile & İlişkiler',
  'aile': 'Aile & İlişkiler',
  'education': 'Eğitim',
  'teaching': 'Eğitim',
  'pedagogy': 'Eğitim',
  'eğitim': 'Eğitim',

  // Biyografi & Anı
  'biography & autobiography': 'Biyografi & Otobiyografi',
  'biography': 'Biyografi & Otobiyografi',
  'autobiography': 'Biyografi & Otobiyografi',
  'memoir': 'Biyografi & Otobiyografi',
  'biyografi': 'Biyografi & Otobiyografi',
  'otobiyografi': 'Biyografi & Otobiyografi',
  'anı': 'Biyografi & Otobiyografi',

  // Din & Maneviyat
  'religion': 'Din',
  'theology': 'Din',
  'islam': 'Din',
  'christianity': 'Din',
  'din': 'Din',
  'tasavvuf': 'Din',
  'ilahiyat': 'Din',

  // Sanat & Mimarlık & Tasarım & Müzik
  'art': 'Sanat',
  'sanat': 'Sanat',
  'architecture': 'Mimarlık',
  'mimarlık': 'Mimarlık',
  'design': 'Tasarım',
  'tasarım': 'Tasarım',
  'music': 'Müzik',
  'müzik': 'Müzik',
  'photography': 'Fotoğrafçılık',
  'fotoğrafçılık': 'Fotoğrafçılık',
  'poetry': 'Şiir',
  'şiir': 'Şiir',
  'drama': 'Tiyatro / Drama',
  'theater': 'Tiyatro / Drama',
  'tiyatro': 'Tiyatro / Drama',

  // Diğer Alanlar
  'cooking': 'Yemek & Mutfak',
  'food & wine': 'Yemek & Mutfak',
  'gastronomy': 'Yemek & Mutfak',
  'yemek': 'Yemek & Mutfak',
  'mutfak': 'Yemek & Mutfak',
  'travel': 'Seyahat',
  'seyahat': 'Seyahat',
  'gezi': 'Seyahat',
  'nature': 'Doğa',
  'environment': 'Doğa',
  'doğa': 'Doğa',
  'true crime': 'Gerçek Suç (True Crime)',
  'comics & graphic novels': 'Çizgi Roman & Grafik Roman',
  'comics': 'Çizgi Roman & Grafik Roman',
  'manga': 'Çizgi Roman & Grafik Roman',
  'çizgi roman': 'Çizgi Roman & Grafik Roman',
  'sports & recreation': 'Spor & Rekreasyon',
  'sports': 'Spor & Rekreasyon',
  'spor': 'Spor & Rekreasyon',
  'games & activities': 'Oyunlar & Aktiviteler',
  'crafts & hobbies': 'El Sanatları & Hobiler',
  'gardening': 'Bahçecilik',
  'house & home': 'Ev & Yaşam',
  'pets': 'Evcil Hayvanlar',
  'humor': 'Mizah',
  'reference': 'Referans / Başvuru Kitapları',
  'study aids': 'Sınav Hazırlık / Çalışma Kaynakları',
  'transportation': 'Ulaşım',
  'language arts & disciplines': 'Yabancı Dil Çalışmaları'
};

// Metin Başlık Formatlayıcı (Türkçe Uyumlu)
function toTurkishTitleCase(str: string): string {
  return str
    .split(' ')
    .filter(Boolean)
    .map(word => {
      if (word.toLowerCase() === '&' || word.toLowerCase() === 've' || word.toLowerCase() === 'ile') return word.toLowerCase();
      return word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1).toLocaleLowerCase('tr-TR');
    })
    .join(' ');
}

// Türkçe Alfabetik Sıralayıcı
export function sortCategoriesInTurkish(categories: string[]): string[] {
  const unique = Array.from(new Set(categories.filter(Boolean)));
  return unique.sort((a, b) => a.localeCompare(b, 'tr'));
}

/**
 * Google Books, Open Library veya dış kaynaklardan gelen kategoriyi Türkçe standart kategoriye çevirir.
 * Listede birebir bulunmayan yeni kategorileri Türkçe formatında düzenler ve döndürür.
 */
export function normalizeBookCategory(rawCategory?: string, bookTitle?: string, bookSummary?: string): string {
  if (rawCategory && typeof rawCategory === 'string' && rawCategory.trim()) {
    const cleaned = rawCategory.trim();

    // 1. Doğrudan listede var mı?
    if (BOOK_CATEGORIES.includes(cleaned)) {
      return cleaned;
    }

    // 2. Alt kategori ayrıştırması (Örn: "Psychology / Trauma / PTSD" -> "Psychology", "Trauma")
    const parts = cleaned.split(/[\/\->]/).map(p => p.trim().toLowerCase()).filter(Boolean);

    for (const part of parts) {
      if (CATEGORY_TRANSLATIONS[part]) {
        return CATEGORY_TRANSLATIONS[part];
      }
      // Kısmi eşleşme
      for (const [key, trCategory] of Object.entries(CATEGORY_TRANSLATIONS)) {
        if (part.includes(key) || key.includes(part)) {
          return trCategory;
        }
      }
    }

    // 3. Genel küçük harf eşleşmesi
    const lower = cleaned.toLowerCase();
    for (const [key, trCategory] of Object.entries(CATEGORY_TRANSLATIONS)) {
      if (lower.includes(key)) {
        return trCategory;
      }
    }

    // 4. Yeni benzersiz bir kategori ise düzgün Türkçe Başlık formatına çevir
    const formattedNewCat = toTurkishTitleCase(cleaned.replace(/[\/_\-]/g, ' ').replace(/\s+/g, ' ').trim());
    if (formattedNewCat) {
      return formattedNewCat;
    }
  }

  // Kategori hiç gelmediyse kitap başlığı ve özetinden akıllı çıkarım yap
  const textContext = `${bookTitle || ''} ${bookSummary || ''}`.toLowerCase();
  
  if (textContext.includes('beden') || textContext.includes('travma') || textContext.includes('terapi') || textContext.includes('psikolog') || textContext.includes('psikiyatri') || textContext.includes('ruh sağlığı') || textContext.includes('kaygı') || textContext.includes('depresyon') || textContext.includes('zihin')) {
    return 'Psikoloji';
  }
  if (textContext.includes('roman') || textContext.includes('kurgu') || textContext.includes('öykü') || textContext.includes('hikaye') || textContext.includes('edebiyat') || textContext.includes('masal') || textContext.includes('cinayet') || textContext.includes('dedektif')) {
    return 'Kurgu (Fiction)';
  }
  if (textContext.includes('para') || textContext.includes('yatırım') || textContext.includes('borsa') || textContext.includes('zengin') || textContext.includes('finans') || textContext.includes('ekonomi') || textContext.includes('şirket') || textContext.includes('girişim')) {
    return 'İş & Ekonomi';
  }
  if (textContext.includes('tarih') || textContext.includes('osmanlı') || textContext.includes('imparatorluk') || textContext.includes('savaş') || textContext.includes('devlet') || textContext.includes('cumhuriyet')) {
    return 'Tarih';
  }
  if (textContext.includes('felsefe') || textContext.includes('etik') || textContext.includes('düşünce') || textContext.includes('varoluş') || textContext.includes('stoa') || textContext.includes('sokrates')) {
    return 'Felsefe';
  }
  if (textContext.includes('yazılım') || textContext.includes('programlama') || textContext.includes('kodlama') || textContext.includes('bilgisayar') || textContext.includes('yapay zeka') || textContext.includes('algoritma')) {
    return 'Bilgisayar';
  }
  if (textContext.includes('sağlık') || textContext.includes('beslenme') || textContext.includes('diyet') || textContext.includes('egzersiz') || textContext.includes('fitness') || textContext.includes('oruç')) {
    return 'Sağlık & Fitness';
  }
  if (textContext.includes('alışkanlık') || textContext.includes('gelişim') || textContext.includes('hedef') || textContext.includes('başarı') || textContext.includes('motivasyon') || textContext.includes('disiplin')) {
    return 'Kişisel Gelişim';
  }

  return 'Kurgu (Fiction)';
}
