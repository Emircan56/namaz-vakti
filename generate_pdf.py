# -*- coding: utf-8 -*-
"""Süleymaniye Vakfı Namaz Vakitleri Hesaplama Formülü - Detaylı Araştırma Raporu"""

import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, ListFlowable, ListItem
)
from reportlab.lib.colors import HexColor
from reportlab.platypus.flowables import HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Font Registration ──
pdfmetrics.registerFont(TTFont('NotoSansSC', '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))

# ── Palette ──
PAGE_BG       = HexColor('#f1f1ef')
SECTION_BG    = HexColor('#efeeed')
CARD_BG       = HexColor('#efeeec')
TABLE_STRIPE  = HexColor('#f1f0ee')
HEADER_FILL   = HexColor('#585038')
COVER_BLOCK   = HexColor('#766b47')
BORDER        = HexColor('#ccc9bf')
ICON          = HexColor('#81703c')
ACCENT        = HexColor('#25738d')
ACCENT_2      = HexColor('#42b042')
TEXT_PRIMARY   = HexColor('#201f1d')
TEXT_MUTED     = HexColor('#827f78')
SEM_INFO      = HexColor('#547595')

# ── Output ──
OUTPUT_PATH = "/home/z/my-project/download/Suleymaniye_Vakfi_Namaz_Vakitleri_Hesaplama_Formulu.pdf"
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

# ── Styles ──
styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    name='CoverTitle',
    fontName='NotoSansSC',
    fontSize=28,
    leading=36,
    textColor=HexColor('#25738d'),
    alignment=TA_CENTER,
    spaceAfter=12,
))

styles.add(ParagraphStyle(
    name='CoverSubtitle',
    fontName='NotoSansSC',
    fontSize=16,
    leading=22,
    textColor=TEXT_MUTED,
    alignment=TA_CENTER,
    spaceAfter=8,
))

styles.add(ParagraphStyle(
    name='H1',
    fontName='NotoSansSC',
    fontSize=20,
    leading=28,
    textColor=ACCENT,
    spaceBefore=24,
    spaceAfter=12,
))

styles.add(ParagraphStyle(
    name='H2',
    fontName='NotoSansSC',
    fontSize=15,
    leading=22,
    textColor=HEADER_FILL,
    spaceBefore=16,
    spaceAfter=8,
))

styles.add(ParagraphStyle(
    name='H3',
    fontName='NotoSansSC',
    fontSize=12,
    leading=18,
    textColor=ICON,
    spaceBefore=10,
    spaceAfter=6,
))

styles.add(ParagraphStyle(
    name='BodyTR',
    fontName='NotoSansSC',
    fontSize=10,
    leading=16,
    textColor=TEXT_PRIMARY,
    alignment=TA_JUSTIFY,
    spaceBefore=4,
    spaceAfter=4,
    firstLineIndent=0,
))

styles.add(ParagraphStyle(
    name='Formula',
    fontName='DejaVuSans',
    fontSize=11,
    leading=18,
    textColor=SEM_INFO,
    alignment=TA_CENTER,
    spaceBefore=8,
    spaceAfter=8,
    backColor=HexColor('#f5f5f0'),
    borderPadding=6,
))

styles.add(ParagraphStyle(
    name='Note',
    fontName='NotoSansSC',
    fontSize=9,
    leading=14,
    textColor=TEXT_MUTED,
    alignment=TA_LEFT,
    spaceBefore=4,
    spaceAfter=4,
    leftIndent=20,
    borderColor=BORDER,
    borderWidth=0.5,
    borderPadding=6,
))

# ── Document ──
doc = SimpleDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    leftMargin=25*mm,
    rightMargin=25*mm,
    topMargin=25*mm,
    bottomMargin=25*mm,
    title="Süleymaniye Vakfı Namaz Vakitleri Hesaplama Formülü",
    author="Z.ai",
    subject="Süleymaniye Vakfı Mîzan Sistemi - Astronomik Hesaplama Yöntemi",
)

story = []

# ══════════════════════════════════════════════════════
# KAPAK
# ══════════════════════════════════════════════════════
story.append(Spacer(1, 60*mm))
story.append(Paragraph("Süleymaniye Vakfı", styles['CoverTitle']))
story.append(Paragraph("Namaz Vakitleri Hesaplama Formülü", styles['CoverTitle']))
story.append(Spacer(1, 10*mm))
story.append(HRFlowable(width="60%", thickness=1, color=ACCENT, spaceAfter=10, spaceBefore=10))
story.append(Spacer(1, 5*mm))
story.append(Paragraph("Mîzan Sistemi - Astronomik Hesaplama Yöntemi", styles['CoverSubtitle']))
story.append(Paragraph("Prof. Dr. Abdülaziz Bayındır'ın Çalışmaları Üzerine", styles['CoverSubtitle']))
story.append(Spacer(1, 20*mm))
story.append(Paragraph("Araştırma Raporu", ParagraphStyle('CoverMeta', parent=styles['CoverSubtitle'], fontSize=12, textColor=TEXT_MUTED)))
story.append(Paragraph("Haziran 2026", ParagraphStyle('CoverDate', parent=styles['CoverSubtitle'], fontSize=11, textColor=TEXT_MUTED)))
story.append(PageBreak())

# ══════════════════════════════════════════════════════
# 1. GİRİŞ
# ══════════════════════════════════════════════════════
story.append(Paragraph("1. Giriş: Süleymaniye Vakfı ve Mîzan Sistemi", styles['H1']))

story.append(Paragraph(
    "Süleymaniye Vakfı, 1978 yılından bu yana namaz vakitlerinin tespiti konusunda çalışan Prof. Dr. Abdülaziz Bayındır "
    "öncülüğünde, Kur'an-ı Kerim'deki işaretleri astronomik hesaplama yöntemleriyle harmanlayan özgün bir sistem "
    "geliştirmiştir. Bu sisteme \"Mîzan\" (mizan/terazi) adı verilmektedir. Mîzan sistemi, namaz vakitlerinin "
    "belirlenmesinde Diyanet İşleri Başkanlığı'nın kullandığı yöntemden önemli farklılıklar taşımaktadır. "
    "Özellikle imsak vaktinin belirlenmesinde kullanılan güneş açısı bakımından Süleymaniye Vakfı -9 dereceyi "
    "referans alırken, Diyanet -18 dereceyi (bazı hesaplamalarda -19 derece + temkin) kullanmaktadır. "
    "Bu fark, özellikle Ramazan ayında imsak vakitlerinde 1 saat 10 dakika civarında bir sapma yaratmaktadır.",
    styles['BodyTR']
))

story.append(Paragraph(
    "Süleymaniye Vakfı, hesaplama yöntemini Kur'an-ı Kerim'deki fecir, zeval, gurub ve ğasak gibi kavramların "
    "astronomik karşılıklarını tespit ederek oluşturmuştur. Vakfın \"Ekvatordan Kutuplara Namaz\" başlıklı çalışması, "
    "1988-1991 yılları arasında yapılan gözlemleri de içermekte olup, 45 derece enlemin üstündeki bölgeler için "
    "gözleme dayalı güncellemeler yapmaya devam etmektedir. Bu raporda, Süleymaniye Vakfı'nın namaz vakitleri "
    "hesaplama formüllerinin detaylı astronomik ve matematiksel çerçevesi sunulmaktadır.",
    styles['BodyTR']
))

# ══════════════════════════════════════════════════════
# 2. ASTRONOMİK TEMELLER
# ══════════════════════════════════════════════════════
story.append(Paragraph("2. Astronomik Temel Kavramlar ve Parametreler", styles['H1']))

story.append(Paragraph("2.1 Güneşin Deklinasyonu (δ)", styles['H2']))

story.append(Paragraph(
    "Güneşin deklinasyonu (δ), güneş ışınlarının Dünya'nın ekvator düzlemi ile yaptığı açıdır. Yıl boyunca "
    "+23.45 derece ile -23.45 derece arasında değişir. Bu değer, mevsimlerin oluşmasından sorumludur ve namaz "
    "vakitlerinin hesaplanmasında en temel parametrelerden biridir. Deklinasyon değerinin doğru hesaplanması, "
    "özellikle imsak ve yatsı gibi güneşin ufuk altındaki açısına bağlı vakitlerin hassasiyetini doğrudan "
    "etkilemektedir.",
    styles['BodyTR']
))

story.append(Paragraph(
    "ABD Deniz Gözlemevi (US Naval Observatory) algoritmasına göre deklinasyon yaklaşık olarak şu şekilde hesaplanır:",
    styles['BodyTR']
))

story.append(Paragraph(
    "d = JD - 2451545.0  (Julian tarihi ofseti)",
    styles['Formula']
))
story.append(Paragraph(
    "g = 357.529 + 0.98560028 x d  (güneşin anomalisi)",
    styles['Formula']
))
story.append(Paragraph(
    "q = 280.459 + 0.98564736 x d  (ekliptik boylam)",
    styles['Formula']
))
story.append(Paragraph(
    "L = q + 1.915 x sin(g) + 0.020 x sin(2g)  (güneşin gerçek boylamı)",
    styles['Formula']
))
story.append(Paragraph(
    "e = 23.439 - 0.00000036 x d  (ekliptik eğiklik)",
    styles['Formula']
))
story.append(Paragraph(
    "D = arcsin(sin(e) x sin(L))  (Güneşin Deklinasyonu)",
    styles['Formula']
))

story.append(Paragraph(
    "Bu algoritma, J2000.0 çağı civarında yaklaşık 1 ark dakikalık doğrulukla güneşin açısal koordinatlarını "
    "vermektedir. Deklinasyon (D), namaz vakitlerinin hesaplanmasında kullanılan T(α) ve A(t) fonksiyonlarında "
    "yer alan sin(δ) ve cos(δ) terimlerinin kaynağıdır.",
    styles['BodyTR']
))

story.append(Paragraph("2.2 Zaman Denklemi (EqT)", styles['H2']))

story.append(Paragraph(
    "Zaman denklemi (Equation of Time), güneş saati ile standart saat arasındaki farkı ifade eder. Dünya'nın "
    "yörünge ekseni ile dönme ekseni arasındaki 23.44 derecelik eğiklik ve yörüngenin eliptik yapısı nedeniyle, "
    "güneşin görünür hareketi yıl boyunca düzgün değildir. Güneş saati, 3 Kasım civarında 16 dakika 33 saniye "
    "fazla, 12 Şubat civarında ise 14 dakika 6 saniye eksik gösterebilir. Bu fark, öğle vaktinin hesaplanmasında "
    "dikkate alınması gereken önemli bir düzeltme faktörüdür.",
    styles['BodyTR']
))

story.append(Paragraph(
    "RA = arctan2(cos(e) x sin(L), cos(L)) / 15  (güneşin sağ yükselişi)",
    styles['Formula']
))
story.append(Paragraph(
    "EqT = q/15 - RA  (Zaman Denklemi, saat cinsinden)",
    styles['Formula']
))

story.append(Paragraph("2.3 Saat Açısı (Hour Angle)", styles['H2']))

story.append(Paragraph(
    "Saat açısı, güneşin yerel meridyenden açısal uzaklığını ifade eder. Öğle vaktinde saat açısı sıfırdır. "
    "Güneş doğarken saat açısı negatif, batarken pozitiftir. Namaz vakitlerinin hesaplanmasında, güneşin "
    "belirli bir zenit açısına (veya ufuk altı açısına) ulaştığı andaki saat açısının bilinmesi gerekir. "
    "Saat açısı derece cinsinden bulunduktan sonra, 15 dereceye bölünerek saat cinsinden zaman farkı elde edilir. "
    "Bu, her bir vaktin öğle vaktine göre öncesini veya sonrasını belirleyen temel mekanizmadır.",
    styles['BodyTR']
))

# ══════════════════════════════════════════════════════
# 3. TEMEL FORMÜLLER
# ══════════════════════════════════════════════════════
story.append(Paragraph("3. Namaz Vakitlerinin Hesaplama Formülleri", styles['H1']))

story.append(Paragraph(
    "Aşağıdaki formüllerde φ (enlem), δ (deklinasyon), L (boylam), TimeZone (saat dilimi) ve EqT (zaman denklemi) "
    "olarak kullanılmaktadır. Tüm açılar derece cinsindendir.",
    styles['BodyTR']
))

# 3.1 Öğle
story.append(Paragraph("3.1 Öğle Vakti (Zeval)", styles['H2']))

story.append(Paragraph(
    "Öğle vakti, güneşin gökyüzündeki en yüksek noktaya (zirve) ulaştığı andır. Bu anda güneşin saat açısı sıfır "
    "olur ve gölgeler en kısa hale gelir. Zeval vaktinin hesaplanması, diğer tüm namaz vakitlerinin referans noktasını "
    "oluşturur. Öğle namazı vakti, zeval anından güneşin batıya meyletmesiyle başlar ve ikindi vaktine kadar devam eder.",
    styles['BodyTR']
))

story.append(Paragraph(
    "Dhuhr = 12 + TimeZone - L/15 - EqT",
    styles['Formula']
))

story.append(Paragraph(
    "Bu formülde; 12, Greenwich üzerinden öğle vaktini; TimeZone, bölgenin saat dilimini; L/15, boylamın saat "
    "cinsinden düzeltmesini; EqT ise zaman denklemi düzeltmesini temsil eder. Örneğin İstanbul için (boylam: "
    "29 derece, saat dilimi: +3), boylam düzeltmesi 29/15 = 1.933 saat olacaktır.",
    styles['BodyTR']
))

# 3.2 Gün Doğumu / Batışı
story.append(Paragraph("3.2 Güneş Doğuşu ve Batışı", styles['H2']))

story.append(Paragraph(
    "Güneş doğuşu ve batışı, güneşin üst kenarının ufuk çizgisinde göründüğü ve kaybolduğu anlardır. "
    "Atmosferik kırılma (refraksiyon) etkisi nedeniyle, güneşin merkezi ufuk çizgisinin altında yaklaşık 0.833 "
    "dereceyken bile güneşin üst kenarı görülebilir. Bu nedenle hesaplamalarda 0.833 derecelik açı kullanılır. "
    "Ancak gözlem yerinin rakımı ve çevresel arazi yapısı bu değeri hafifçe etkileyebilir.",
    styles['BodyTR']
))

story.append(Paragraph(
    "T(a) = (1/15) x arccos[(-sin(a) - sin(f) x sin(d)) / (cos(f) x cos(d))]",
    styles['Formula']
))

story.append(Paragraph(
    "Güneş Doğuşu = Dhuhr - T(0.833)",
    styles['Formula']
))
story.append(Paragraph(
    "Güneş Batışı = Dhuhr + T(0.833)",
    styles['Formula']
))

story.append(Paragraph(
    "Burada T(a) fonksiyonu, güneşin merkezinin ufuk altında a derecesine ulaşması için geçen süreyi (saat "
    "cinsinden) verir. Bu fonksiyon, imsak, akşam ve yatsı vakitlerinin hesaplanmasında da temel rol oynar. "
    "f enlemi ve d deklinasyonu, T fonksiyonunun en önemli girdileridir ve yılın her günü için farklı "
    "değerler alırlar.",
    styles['BodyTR']
))

# 3.3 İmsak
story.append(Paragraph("3.3 İmsak Vakti (Fecr-i Sadık)", styles['H2']))

story.append(Paragraph(
    "İmsak vakti, Kur'an-ı Kerim'de \"fecir\" (Bakara 2/187) olarak geçen ve güneşin doğu ufkunda ilk "
    "aydınlığın belirdiği andır. Bu andan itibaren oruç yasakları başlar ve sabah namazının vakti girer. "
    "Süleymaniye Vakfı, fecr-i sadık anını güneşin ufuk çizgisinin altında -9 dereceye ulaşması olarak tespit "
    "etmiştir. Bu değer, Prof. Dr. Abdülaziz Bayındır'ın 1988-1991 yılları arasında yaptığı gözlemler ve "
    "Kur'an'daki fecir tanımının astronomik karşılığının araştırılması sonucunda belirlenmiştir.",
    styles['BodyTR']
))

story.append(Paragraph(
    "İmsak = Dhuhr - T(9)",
    styles['Formula']
))

story.append(Paragraph(
    "Yani Süleymaniye Vakfı'na göre imsak vakti, öğle vaktinden T(9) fonksiyonu kadar önceye düşen andır. "
    "T(9) fonksiyonu ise güneşin merkezinin ufuk altında 9 dereceye ulaştığı anın saat cinsinden ifadesidir. "
    "Bu hesaplama, ufuk üzerinde beyazlığın ilk görüldüğü anı temsil eder ve çıplak gözle her yerden "
    "rahatlıkla gözlemlenebilir.",
    styles['BodyTR']
))

story.append(Paragraph(
    "Not: Süleymaniye Vakfı'nın \"Ekvatordan Kutuplara Namaz\" başlıklı çalışmasında bu açı -8.5 derece "
    "olarak da geçmektedir. Bu, gözlemsel varyasyonları yansıtır ve rakım/atmosfer koşullarına bağlı "
    "küçük farklılıkları ifade eder.",
    styles['Note']
))

# 3.4 Fecr-i Kâzib
story.append(Paragraph("3.4 Fecr-i Kâzib (Seher Vakti)", styles['H2']))

story.append(Paragraph(
    "Fecr-i kâzib (yalancı fecir), doğu ufkunda dikey bir ışık sütunu şeklinde görülen ve fecr-i sadıktan "
    "önce ortaya çıkan aydınlıktır. Bu, güneşin ufkun altında daha derinlerde olduğu bir anda atmosferik "
    "yansıma ve kırılma sonucu oluşur. Kur'an'da \"siyah iplik beyaz iplikten ayırt edilinceye kadar\" "
    "(Bakara 2/187) ifadesindeki ayırt etme, fecr-i sadıkla başlar; fecr-i kâzib bu ayırt etmeye dahil "
    "değildir. Süleymaniye Vakfı takviminde seher (fecr-i kâzib) vakti de gösterilir; bu vakit, gecenin "
    "ortası olarak kabul edilir ve güneşin yaklaşık -15 ile -18 derece altına düşmesiyle oluşur.",
    styles['BodyTR']
))

story.append(Paragraph(
    "Seher (Fecr-i Kâzib) = Dhuhr - T(a)  (a yaklasik 15-18 derece)",
    styles['Formula']
))

story.append(Paragraph(
    "Süleymaniye Vakfı takviminde seher vakti, gecenin ortası olarak kabul edilir ve fecr-i kâzib olarak "
    "adlandırılır. Bu vakitte kalkmak sünnettir ancak oruca başlamak için yeterli değildir. Vakfın "
    "web sitesinde bu iki vakit arasındaki fark açıkça gösterilmektedir: seher vakti imsaktan daha "
    "erkendir ve geceden sayılır.",
    styles['BodyTR']
))

# 3.5 İkindi
story.append(Paragraph("3.5 İkindi Vakti", styles['H2']))

story.append(Paragraph(
    "İkindi vakti, bir cismin gölge uzunluğunun belirli bir orana ulaşmasıyla belirlenir. Hanefi mezhebine "
    "göre, ikindi vakti bir cismin gölgesinin, cismin kendi boyunun iki katı artı öğle vaktindeki gölge "
    "uzunluğu kadar olmasıyla başlar. Şafii, Maliki, Hanbeli ve Caferi mezheplerinde ise bu oran bire "
    "eşittir. Süleymaniye Vakfı, Hanefi mezhebinin görüşünü esas alarak gölge oranı 2 olarak hesaplama "
    "yapar.",
    styles['BodyTR']
))

story.append(Paragraph(
    "A(t) = (1/15) x arccos[(sin(arctan(1/(t + tan(|f - d|)))) - sin(f) x sin(d)) / (cos(f) x cos(d))]",
    styles['Formula']
))

story.append(Paragraph(
    "Hanefi Mezhebi: Asr = Dhuhr + A(2)",
    styles['Formula']
))
story.append(Paragraph(
    "Diger Mezhepler: Asr = Dhuhr + A(1)",
    styles['Formula']
))

story.append(Paragraph(
    "Burada t, gölge çarpanını (Hanefi'de 2, diğerlerinde 1), f enlemi ve d deklinasyonu ifade eder. "
    "A fonksiyonu, gölgenin belirtilen orana ulaştığı anın öğle vaktine olan uzaklığını saat cinsinden "
    "verir. Bu hesaplama yöntemi, tamamen güneşin konumuna dayandığı için yılın her döneminde ve "
    "her enlemde farklı ikindi vakitleri üretir.",
    styles['BodyTR']
))

# 3.6 Akşam
story.append(Paragraph("3.6 Akşam Vakti (Mağrib)", styles['H2']))

story.append(Paragraph(
    "Süleymaniye Vakfı'na göre akşam namazı vakti, güneşin tamamen ufuk çizgisinin altına inmesiyle "
    "(gurub) başlar. Bu, astronomik batış anına denk gelir. Vakfın hesaplamasında akşam vakti için "
    "güneşin batış açısı 0.833 derece (atmosferik kırılma düzeltmeli) kullanılır ve Diyanet'in aksine "
    "ek bir temkin süresi uygulanmaz.",
    styles['BodyTR']
))

story.append(Paragraph(
    "Aksam = Dhuhr + T(0.833) = Gun Batısı",
    styles['Formula']
))

story.append(Paragraph(
    "Süleymaniye Vakfı takviminde akşam vakti, doğrudan güneşin batış anını gösterir. Bu konuda "
    "Diyanet, güneş batışından sonra 7 dakikalık temkin süresi uygularken, Süleymaniye Vakfı "
    "böyle bir ilave yapmamaktadır. Bu durum, özellikle oruç açma vakitlerinde fark yaratmaktadır.",
    styles['BodyTR']
))

# 3.7 Yatsı
story.append(Paragraph("3.7 Yatsı Vakti (İşa / Ğasak)", styles['H2']))

story.append(Paragraph(
    "Yatsı vakti, Kur'an-ı Kerim'de \"ğasaku'l-leyl\" (gece karanlığının çökmesi) olarak ifade edilen "
    "andır. Süleymaniye Vakfı, yatsı vaktini kırmızı şafağın (kızıl aydınlığın) tamamen kaybolduğu an "
    "olarak belirler. Bu, güneşin ufuk altında yaklaşık -9 ile -15 derece arasına düşmesiyle gerçekleşir. "
    "Süleymaniye Vakfı'nın yatsı vakti hesaplamasında da Kur'an'daki ğasak kavramının astronomik "
    "karşılığı esas alınmaktadır.",
    styles['BodyTR']
))

story.append(Paragraph(
    "Yatsı = Dhuhr + T(a_yatsi)",
    styles['Formula']
))

story.append(Paragraph(
    "Süleymaniye Vakfı'nın yatsı vakti için kullandığı açı değeri, fecr-i sadıktaki gibi -9 derece "
    "olarak kabul edilmekle birlikte, bazı kaynaklarda kırmızı şafağın kaybolması için -15 derece "
    "civarındaki açılar da kullanılabilmektedir. Vakfın resmi takvim uygulamasında bu hesaplama, "
    "gözlemsel verilerle desteklenmektedir.",
    styles['BodyTR']
))

# 3.8 Gece Yarısı
story.append(Paragraph("3.8 Gece Yarısı (Nısfu'l-Leyl)", styles['H2']))

story.append(Paragraph(
    "Gece yarısı, Süleymaniye Vakfı'na göre güneşin batışı ile doğuşu arasındaki sürenin ortasıdır. "
    "Bu hesaplama, yatsı namazının son vaktinin belirlenmesinde kullanılır.",
    styles['BodyTR']
))

story.append(Paragraph(
    "Gece Yarısı = 1/2 x (Gun Dogusu - Gun Batısı)",
    styles['Formula']
))

# ══════════════════════════════════════════════════════
# 4. AÇI DEĞERLERİ KARŞILAŞTIRMA
# ══════════════════════════════════════════════════════
story.append(Paragraph("4. Süleymaniye Vakfı ve Diyanet Açı Değerleri Karşılaştırması", styles['H1']))

story.append(Paragraph(
    "Namaz vakitleri hesaplamalarında en kritik farklılık, imsak ve yatsı vakitlerinde kullanılan güneş "
    "ufuk altı açılarında ortaya çıkmaktadır. Aşağıdaki tablo, Süleymaniye Vakfı ile Diyanet İşleri "
    "Başkanlığı'nın kullandığı açı değerlerini karşılaştırmalı olarak sunmaktadır. Bu farklılıklar, "
    "özellikle yüksek enlemlerde daha belirgin hale gelmekte ve imsak vakitlerinde 1 saati aşan sapmalara "
    "yol açabilmektedir.",
    styles['BodyTR']
))

# Comparison Table
table_data = [
    ['Vakit', 'Süleymaniye Vakfı', 'Diyanet', 'Fark'],
    ['İmsak (Fecr-i Sadık)', '-9 derece', '-18 derece (-19+temkin)', 'Yak. 9-10 derece'],
    ['Seher (Fecr-i Kâzib)', 'Yak. -15/-18 derece', 'Gösterilmez', '-'],
    ['Güneş Doğuşu', '0.833 derece', '0.833 derece + 7 dk temkin', '7 dakika'],
    ['Öğle', 'Zeval', 'Zeval + 1 dk temkin', '1 dakika'],
    ['İkindi (Hanefi)', 'Gölge oranı = 2', 'Gölge oranı = 2', 'Aynı'],
    ['Akşam', '0.833 derece', '0.833 derece + 7 dk temkin', '7 dakika'],
    ['Yatsı', 'Kırmızı şafak kaybı', '-17 derece', 'Farklı yöntem'],
    ['Temkin', 'Uygulanmaz', '7-10 dakika', 'Temkin farkı'],
]

col_widths = [90, 130, 140, 100]
t = Table(table_data, colWidths=col_widths)
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('FONTNAME', (0, 0), (-1, -1), 'NotoSansSC'),
    ('FONTSIZE', (0, 0), (-1, 0), 10),
    ('FONTSIZE', (0, 1), (-1, -1), 9),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_STRIPE]),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
]))
story.append(t)
story.append(Spacer(1, 10))

# ══════════════════════════════════════════════════════
# 5. TEMKİN KAVRAMI
# ══════════════════════════════════════════════════════
story.append(Paragraph("5. Temkin Kavramı ve Süleymaniye Vakfı'nın Yaklaşımı", styles['H1']))

story.append(Paragraph(
    "Temkin (ihtiyat), namaz vakitlerinin hesaplanmasında olası hata paylarını dengelemek amacıyla "
    "belirli vakitlere eklenen sürelerdir. Diyanet İşleri Başkanlığı, güneş doğuşu ve batışına 7 dakika, "
    "imsak vaktine ise 10 dakika gibi temkin süreleri uygulamaktadır. Bu uygulamanın temelinde, hesaplama "
    "hatalarına karşı ihtiyaten hareket etme ve ibadetlerin vaktinde yerine getirilmesini garanti altına "
    "alma düşüncesi yatar.",
    styles['BodyTR']
))

story.append(Paragraph(
    "Süleymaniye Vakfı ise temkin uygulamasını reddetmektedir. Vakfın görüşüne göre, Kur'an'da belirtilen "
    "vakitler net ve ölçülebilir olduğundan, astronomik hesaplamaların doğruluğuna güvenilmesi gerekmektedir. "
    "Temkin eklemek, aslında vakitleri olduğandan farklı göstermek anlamına gelmektedir. Prof. Dr. Bayındır, "
    "yaptığı gözlemlerde hesaplanan vakitlerin gözlemlenen vakitlerle büyük ölçüde örtüştüğünü, bu nedenle "
    "temkin uygulamasına gerek olmadığını savunmaktadır. Bu yaklaşım, Süleymaniye takvimini Diyanet takviminden "
    "ayıran en önemli farklardan biridir.",
    styles['BodyTR']
))

# ══════════════════════════════════════════════════════
# 6. İMSAK FARKININ ANALİZİ
# ══════════════════════════════════════════════════════
story.append(Paragraph("6. İmsak Vaktindeki Farkın Detaylı Analizi", styles['H1']))

story.append(Paragraph(
    "Süleymaniye Vakfı ile Diyanet arasındaki en belirgin fark, imsak vaktindeki sapmadır. Diyanet -18 "
    "derece açısını (bazı hesaplamalarda -19 derece + temkin) kullanırken, Süleymaniye Vakfı -9 dereceyi "
    "kullanmaktadır. Bu yaklaşık 9-10 derecelik açı farkı, İstanbul'da yaz aylarında imsak vakitlerinde "
    "yaklaşık 1 saat 10 dakikalık bir zaman farkına karşılık gelmektedir. Kış aylarında bu fark biraz "
    "daha azalmakla birlikte, yıl boyunca önemli bir farklılık sürmektedir.",
    styles['BodyTR']
))

story.append(Paragraph(
    "Bu farkın kaynağı, fecr-i sadıkın tanımındaki farklılıklara dayanmaktadır. Diyanet ve çoğu İslam "
    "ülkesinin kullandığı -18 derece açısı, astronomik şafak (astronomical twilight) olarak bilinir ve "
    "gökyüzünün tamamen karanlık olduğu anı temsil eder. Ancak Süleymaniye Vakfı, Kur'an'daki fecir "
    "tanımının bu değil, ufkun üzerinde beyazlığın ilk görüldüğü an olduğunu savunmaktadır. Bu an, "
    "güneş ufkun 9 derece altına inince gerçekleşir ve çıplak gözle açıkça gözlemlenebilir.",
    styles['BodyTR']
))

story.append(Paragraph(
    "Süleymaniye Vakfı'nın iddiası, Bakara Suresi 187. ayetteki \"beyaz iplik siyah iplikten ayırt "
    "edilinceye kadar\" ifadesinin, gökyüzünde ayırt edilebilir ilk ışığın (beyazlığın) ortaya çıkmasını "
    "ifade ettiği yönündedir. -18 derecede ise gökyüzü hâlâ tamamen karanlıktır ve çıplak gözle herhangi "
    "bir aydınlık fark edilemez. Bu nedenle Süleymaniye Vakfı, -18 derecenin Kur'an'daki fecir tanımına "
    "uymadığını ileri sürmektedir.",
    styles['BodyTR']
))

# ══════════════════════════════════════════════════════
# 7. YÜKSEK ENLEMLER
# ══════════════════════════════════════════════════════
story.append(Paragraph("7. Yüksek Enlemlerde Karşılaşılan Sorunlar", styles['H1']))

story.append(Paragraph(
    "45 derecenin üstündeki enlemlerde, özellikle yaz aylarında güneş ufuk altına yeterince derinlemesine "
    "inemeyebilir. Bu durumda fecr-i sadık ve yatsı vakitlerinin belirlenmesi standart formüllerle mümkün "
    "olmaz. Süleymaniye Vakfı, 45 derecenin üstündeki enlemler için hesaplamalarını gözlemsel verilerle "
    "desteklemekte ve takvimini güncellemeye devam etmektedir. Vakfın \"45 Derece Enlemin Üstü İçin "
    "Takvimin Güncellenmesi Hakkında\" başlıklı açıklamasında, bu bölgelerde en doğru vakitleri tayin "
    "etmek için gözleme ve geliştirmeye devam edildiği belirtilmektedir.",
    styles['BodyTR']
))

story.append(Paragraph(
    "Yüksek enlemlerde uygulanan alternatif yöntemler şunlardır:",
    styles['BodyTR']
))

methods_data = [
    ['Yöntem', 'Açıklama'],
    ['Gece Yarısı Yöntemi', 'Güneş batışı ile doğuşu arasındaki süre ikiye bölünür. İlk yarısı gece, ikinci yarısı fecir kabul edilir.'],
    ['Yedide Bir Yöntemi', 'Gece süresi yediye bölünür. İlk bölümün sonu yatsı, son bölümün başı imsak kabul edilir.'],
    ['Açıya Dayalı Yöntem', 'Şafak açısı (a) 60\'a bölünerek gece süresinin oranı belirlenir. a/60 oranı gece süresiyle çarpılarak yatsı ve imsak hesaplanır.'],
]

t2 = Table(methods_data, colWidths=[110, 350])
t2.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('FONTNAME', (0, 0), (-1, -1), 'NotoSansSC'),
    ('FONTSIZE', (0, 0), (-1, 0), 10),
    ('FONTSIZE', (0, 1), (-1, -1), 9),
    ('ALIGN', (0, 0), (0, -1), 'CENTER'),
    ('ALIGN', (1, 0), (1, -1), 'LEFT'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_STRIPE]),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ('LEFTPADDING', (1, 1), (1, -1), 10),
]))
story.append(t2)
story.append(Spacer(1, 10))

story.append(Paragraph(
    "Süleymaniye Vakfı, kutup bölgelerinde güneşin doğmadığı dönemlerde, güneşin doğu noktasına "
    "9 derece yaklaşmasını sabah namazı vakti olarak kabul etmektedir. Bu, Prof. Dr. Bayındır'ın "
    "\"Ekvatordan Kutuplara Namaz\" başlıklı çalışmasında detaylandırılmıştır.",
    styles['BodyTR']
))

# ══════════════════════════════════════════════════════
# 8. UYGULAMA ÖRNEĞİ
# ══════════════════════════════════════════════════════
story.append(Paragraph("8. İstanbul İçin Hesaplama Örneği", styles['H1']))

story.append(Paragraph(
    "Aşağıda, 21 Haziran (yaz gündönümü) tarihi için İstanbul koordinatlarında (enlem: 41.0 derece K, "
    "boylam: 29.0 derece D, saat dilimi: UTC+3) namaz vakitlerinin Süleymaniye Vakfı yöntemine göre "
    "hesaplanması gösterilmektedir. Bu tarih, en uzun gündüz ve en kısa gece yaşandığı için vakitler "
    "arasındaki farkların en belirgin olduğu dönemdir.",
    styles['BodyTR']
))

story.append(Paragraph("8.1 Parametreler", styles['H2']))

params_data = [
    ['Parametre', 'Değer'],
    ['Enlem (f)', '41.0 derece K'],
    ['Boylam (L)', '29.0 derece D'],
    ['Saat Dilimi', 'UTC+3'],
    ['Deklinasyon (d) - 21 Haziran', '+23.44 derece (yaklasik)'],
    ['Zaman Denklemi (EqT)', 'Yaklasik -1.7 dakika'],
]

t3 = Table(params_data, colWidths=[180, 280])
t3.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('FONTNAME', (0, 0), (-1, -1), 'NotoSansSC'),
    ('FONTSIZE', (0, 0), (-1, 0), 10),
    ('FONTSIZE', (0, 1), (-1, -1), 9),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_STRIPE]),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
]))
story.append(t3)
story.append(Spacer(1, 10))

story.append(Paragraph("8.2 Adım Adım Hesaplama", styles['H2']))

story.append(Paragraph(
    "1. OgLE Vakti: Dhuhr = 12 + 3 - 29/15 - EqT = 12 + 3 - 1.933 - (-0.028) = 13.095 saat = 13:06 (yaklasik)",
    styles['Formula']
))

story.append(Paragraph(
    "2. T(0.833) hesabi (gun dogusu/batisi icin): arccos[(-sin(0.833) - sin(41) x sin(23.44)) / (cos(41) x cos(23.44))] / 15 = yaklasik 5.57 saat",
    styles['Formula']
))

story.append(Paragraph(
    "3. Gun Dogusu = 13:06 - 5:34 = 05:32 (yaklasik)  |  Gun Batisi = 13:06 + 5:34 = 20:40 (yaklasik)",
    styles['Formula']
))

story.append(Paragraph(
    "4. T(9) hesabi (imsak icin): arccos[(-sin(9) - sin(41) x sin(23.44)) / (cos(41) x cos(23.44))] / 15 = yaklasik 7.05 saat",
    styles['Formula']
))

story.append(Paragraph(
    "5. İmsak = 13:06 - 7:03 = 06:03 (yaklasik)  --- Süleymaniye Vakfı takvimi ile tutarlı",
    styles['Formula']
))

story.append(Paragraph(
    "6. T(18) hesabi (Diyanet imsaki icin): arccos[(-sin(18) - sin(41) x sin(23.44)) / (cos(41) x cos(23.44))] / 15 = yaklasik 8.27 saat",
    styles['Formula']
))

story.append(Paragraph(
    "7. Diyanet İmsak = 13:06 - 8:16 = 04:50 (yaklasik)  --- 1 saat 13 dk fark!",
    styles['Formula']
))

story.append(Paragraph(
    "Bu örnek, Süleymaniye Vakfı ile Diyanet arasındaki imsak farkının yaz aylarında ne denli büyük "
    "olabileceğini açıkça göstermektedir. -9 derece açısıyla hesaplanan imsak vakti, doğu ufkunda "
    "beyazlığın çıplak gözle görülebildiği ana karşılık gelirken, -18 derece açısıyla hesaplanan "
    "imsak vakti, gökyüzünün hâlâ tamamen karanlık olduğu bir anı temsil etmektedir.",
    styles['BodyTR']
))

# ══════════════════════════════════════════════════════
# 9. DÜNYA GENELİNDEKİ YÖNTEMLER
# ══════════════════════════════════════════════════════
story.append(Paragraph("9. Dünya Genelindeki Hesaplama Yöntemleri Karşılaştırması", styles['H1']))

story.append(Paragraph(
    "Namaz vakitlerinin hesaplanmasında dünya genelinde farklı açı değerleri kullanılmaktadır. Aşağıdaki "
    "tablo, başlıca İslam kuruluşlarının imsak ve yatsı vakitleri için kullandığı açı değerlerini "
    "sunmaktadır. Görüldüğü üzere, Süleymaniye Vakfı'nın -9 derecelik imsak açısı, dünya genelindeki "
    "diğer yöntemlerden belirgin şekilde farklıdır. Bu durum, fecr-i sadık tanımındaki farklı anlayışlardan "
    "kaynaklanmaktadır.",
    styles['BodyTR']
))

world_data = [
    ['Kuruluş / Yöntem', 'İmsak Açısı', 'Yatsı Açısı'],
    ['Müslüman Dünya Ligi', '18 derece', '17 derece'],
    ['ISNA (Kuzey Amerika)', '15 derece', '15 derece'],
    ['Mısır Genel Araştırma Kurumu', '19.5 derece', '17.5 derece'],
    ["Ummu'l-Kura (Mekke)", '18.5 derece', '90 dk (Magrib sonrasi)'],
    ['Karaçi İslam Bilimleri Üni.', '18 derece', '18 derece'],
    ['Tahran Üniversitesi', '17.7 derece', '14 derece'],
    ['Kum Araştırma Enstitüsü', '16 derece', '14 derece'],
    ['Fransa Müslümanları', '12 derece', '12 derece'],
    ['Singapur İslam Dairesi', '20 derece', '18 derece'],
    ['Süleymaniye Vakfı (Mîzan)', '9 derece', 'Kırmızı şafak kaybı'],
]

t4 = Table(world_data, colWidths=[200, 130, 130])
t4.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('FONTNAME', (0, 0), (-1, -1), 'NotoSansSC'),
    ('FONTSIZE', (0, 0), (-1, 0), 9),
    ('FONTSIZE', (0, 1), (-1, -1), 8),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_STRIPE]),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    # Highlight Süleymaniye row
    ('BACKGROUND', (0, -1), (-1, -1), HexColor('#e8f4f8')),
]))
story.append(t4)
story.append(Spacer(1, 10))

# ══════════════════════════════════════════════════════
# 10. KAYNAKLAR
# ══════════════════════════════════════════════════════
story.append(Paragraph("10. Kaynaklar", styles['H1']))

refs = [
    "Süleymaniye Vakfı, \"45 Derece Enlemin Üstü İçin Takvimin Güncellenmesi Hakkında\", suleymaniyevakfi.org",
    "Bayındır, A. (2012), \"Ekvatordan Kutuplara Namaz\", Süleymaniye Vakfı Yayınları",
    "Bayındır, A., \"Kur'an'da Namaz Vakitleri ve İmsak\", Ceride-i İlmiyye Dergisi",
    "PrayTimes.org, \"Prayer Times Calculation\", praytimes.org/docs/calculation",
    "ABD Deniz Gözlemevi, \"Approximate Solar Coordinates\" algoritması",
    "Süleymaniye Takvimi, suleymaniyetakvimi.com/prayerTimesResearchGroup.html",
    "İzEdebiyat, \"Güneşin Ufuk Düzlemindeki Hareketi ve Süleymaniye Vakfı Yöntemine Göre Namaz Vakitlerinin Hesaplanması\"",
    "İzEdebiyat, \"Namaz Vakitlerinin Belirlenmesi: Kur'an'a ve Astronomik Hesaplamalara Dayalı Bir Yaklaşım\"",
    "Diyanet İşleri Başkanlığı, Vakit Hesaplama Birimi, vakithesaplama.diyanet.gov.tr",
    "Fetva.net, \"Süleymaniye Vakfı Takviminde Fecr-i Kâzib Ne Anlama Geliyor?\"",
]

for i, ref in enumerate(refs, 1):
    story.append(Paragraph(
        f"[{i}] {ref}",
        ParagraphStyle('Ref', parent=styles['BodyTR'], fontSize=9, leftIndent=20, firstLineIndent=-20)
    ))

# ── Build ──
doc.build(story)
print(f"PDF generated: {OUTPUT_PATH}")
