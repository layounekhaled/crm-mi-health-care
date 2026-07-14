#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Guide de Déploiement MinIO sur Coolify - Body PDF (ReportLab)
Pour le projet Dalia
"""

import os, sys, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm, cm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, Image, Flowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus.tableofcontents import TableOfContents

# ━━ Font Registration ━━
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold', italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# Install font fallback for mixed CJK/Latin text
sys.path.insert(0, '/home/z/my-project/skills/pdf/scripts')
from pdf import install_font_fallback
install_font_fallback()

# ━━ Cascade Palette ━━
PAGE_BG       = colors.HexColor('#f1f0ef')
SECTION_BG    = colors.HexColor('#ebeae8')
CARD_BG       = colors.HexColor('#e8e7e2')
TABLE_STRIPE  = colors.HexColor('#ededea')
HEADER_FILL   = colors.HexColor('#514b38')
COVER_BLOCK   = colors.HexColor('#7b745e')
BORDER        = colors.HexColor('#c3beac')
ICON          = colors.HexColor('#98813c')
ACCENT        = colors.HexColor('#897128')
ACCENT_2      = colors.HexColor('#5e3bc6')
TEXT_PRIMARY   = colors.HexColor('#1d1c1a')
TEXT_MUTED     = colors.HexColor('#86837c')
SEM_SUCCESS   = colors.HexColor('#44925e')
SEM_WARNING   = colors.HexColor('#93773e')
SEM_ERROR     = colors.HexColor('#a95850')
SEM_INFO      = colors.HexColor('#476f97')

# ━━ Color roles for tables ━━
TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ━━ Page Setup ━━
PAGE_W, PAGE_H = A4
LEFT_MARGIN = 1.0 * inch
RIGHT_MARGIN = 1.0 * inch
TOP_MARGIN = 0.8 * inch
BOTTOM_MARGIN = 0.8 * inch
AVAILABLE_WIDTH = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN

# ━━ Styles ━━
styles = getSampleStyleSheet()

# H1 style
h1_style = ParagraphStyle(
    name='H1Style',
    fontName='NotoSerifSC-Bold',
    fontSize=20,
    leading=28,
    textColor=TEXT_PRIMARY,
    spaceBefore=18,
    spaceAfter=12,
    alignment=TA_LEFT,
)

# H2 style
h2_style = ParagraphStyle(
    name='H2Style',
    fontName='NotoSerifSC-Bold',
    fontSize=14,
    leading=20,
    textColor=HEADER_FILL,
    spaceBefore=14,
    spaceAfter=8,
    alignment=TA_LEFT,
)

# H3 style
h3_style = ParagraphStyle(
    name='H3Style',
    fontName='NotoSerifSC-Bold',
    fontSize=12,
    leading=17,
    textColor=ACCENT,
    spaceBefore=10,
    spaceAfter=6,
    alignment=TA_LEFT,
)

# Body style (French = Latin, use FreeSerif)
body_style = ParagraphStyle(
    name='BodyStyle',
    fontName='FreeSerif',
    fontSize=10.5,
    leading=17,
    textColor=TEXT_PRIMARY,
    alignment=TA_JUSTIFY,
    spaceBefore=0,
    spaceAfter=6,
    firstLineIndent=0,
)

# Body italic
body_italic = ParagraphStyle(
    name='BodyItalic',
    fontName='FreeSerif-Italic',
    fontSize=10.5,
    leading=17,
    textColor=TEXT_MUTED,
    alignment=TA_LEFT,
    spaceBefore=0,
    spaceAfter=6,
)

# Code style
code_style = ParagraphStyle(
    name='CodeStyle',
    fontName='SarasaMonoSC',
    fontSize=9,
    leading=13,
    textColor=TEXT_PRIMARY,
    alignment=TA_LEFT,
    spaceBefore=4,
    spaceAfter=4,
    leftIndent=12,
    backColor=SECTION_BG,
    borderColor=BORDER,
    borderWidth=0.5,
    borderPadding=6,
)

# Bullet style
bullet_style = ParagraphStyle(
    name='BulletStyle',
    fontName='FreeSerif',
    fontSize=10.5,
    leading=17,
    textColor=TEXT_PRIMARY,
    alignment=TA_LEFT,
    spaceBefore=2,
    spaceAfter=2,
    leftIndent=24,
    bulletIndent=12,
)

# Table header style
tbl_header_style = ParagraphStyle(
    name='TableHeader',
    fontName='FreeSerif-Bold',
    fontSize=10,
    leading=14,
    textColor=TABLE_HEADER_TEXT,
    alignment=TA_CENTER,
)

# Table cell style
tbl_cell_style = ParagraphStyle(
    name='TableCell',
    fontName='FreeSerif',
    fontSize=9.5,
    leading=14,
    textColor=TEXT_PRIMARY,
    alignment=TA_LEFT,
)

tbl_cell_center = ParagraphStyle(
    name='TableCellCenter',
    fontName='FreeSerif',
    fontSize=9.5,
    leading=14,
    textColor=TEXT_PRIMARY,
    alignment=TA_CENTER,
)

# Caption style
caption_style = ParagraphStyle(
    name='CaptionStyle',
    fontName='FreeSerif-Italic',
    fontSize=9,
    leading=13,
    textColor=TEXT_MUTED,
    alignment=TA_CENTER,
    spaceBefore=3,
    spaceAfter=6,
)

# Note/callout style
note_style = ParagraphStyle(
    name='NoteStyle',
    fontName='FreeSerif-Italic',
    fontSize=10,
    leading=15,
    textColor=SEM_INFO,
    alignment=TA_LEFT,
    leftIndent=18,
    borderColor=SEM_INFO,
    borderWidth=1,
    borderPadding=8,
    backColor=colors.HexColor('#f0f4f8'),
)

# TOC styles
toc_h1_style = ParagraphStyle(
    name='TOCH1',
    fontName='FreeSerif-Bold',
    fontSize=12,
    leading=20,
    leftIndent=0,
    textColor=TEXT_PRIMARY,
)

toc_h2_style = ParagraphStyle(
    name='TOCH2',
    fontName='FreeSerif',
    fontSize=10.5,
    leading=18,
    leftIndent=20,
    textColor=TEXT_MUTED,
)


# ━━ TocDocTemplate ━━
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))


def add_heading(text, style, level=0):
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p


def make_table(data, col_ratios=None, col_widths=None):
    """Create a styled table with proper widths."""
    if col_ratios:
        col_widths = [r * AVAILABLE_WIDTH for r in col_ratios]
    elif not col_widths:
        col_widths = None

    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]
    # Alternating row colors
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t


def add_note(text):
    return Paragraph(text, note_style)


# ━━ Build Story ━━
OUTPUT_PATH = '/home/z/my-project/download/minio_coolify_guide_body.pdf'
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

doc = TocDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    leftMargin=LEFT_MARGIN,
    rightMargin=RIGHT_MARGIN,
    topMargin=TOP_MARGIN,
    bottomMargin=BOTTOM_MARGIN,
    title='Guide de Deploiement MinIO sur Coolify - Projet Dalia',
    author='Z.ai',
    creator='Z.ai',
    subject='Guide technique pour le deploiement de MinIO sur Coolify pour le stockage des fichiers du projet Dalia',
)

story = []

# ── Table of Contents ──
story.append(Paragraph('<b>Table des matieres</b>', h1_style))
story.append(Spacer(1, 12))
toc = TableOfContents()
toc.levelStyles = [toc_h1_style, toc_h2_style]
story.append(toc)
story.append(PageBreak())

# ════════════════════════════════════════════════════════════════
# CHAPTER 1: Introduction
# ════════════════════════════════════════════════════════════════
story.append(add_heading('<b>1. Introduction</b>', h1_style, level=0))
story.append(Spacer(1, 6))

story.append(add_heading('<b>1.1 Contexte du projet Dalia</b>', h2_style, level=1))
story.append(Paragraph(
    "Le projet Dalia est une application web qui gere des donnees sensibles incluant des documents PDF, "
    "des images, et des fichiers joints necessaires au fonctionnement quotidien de l'organisme. "
    "Actuellement, ces fichiers sont stockes dans des volumes Docker locaux sur le serveur Coolify, "
    "ce qui presente des risques importants en termes de perte de donnees, de scalabilite et de sauvegarde. "
    "En effet, les volumes Docker ne beneficient pas de mecanismes de sauvegarde automatique integres "
    "et restent dependants de l'infrastructure physique du serveur hote. En cas de panne materielle, "
    "de corruption de volume ou d'erreur de manipulation, les fichiers uploades par les utilisateurs "
    "peuvent etre definitivement perdus sans possibilite de recuperation.",
    body_style
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "La base de donnees PostgreSQL, quant a elle, beneficie deja d'un systeme de sauvegarde automatique "
    "via les fonctionnalites natives de Coolify. Les backups reguliers de la base garantissent que les "
    "donnees relationnelles (utilisateurs, configurations, metadonnees) sont protegees. Cependant, les "
    "fichiers binaires stockes en dehors de la base de donnees ne sont pas couverts par ce mecanisme. "
    "Il est donc imperatif de mettre en place une solution de stockage dediee qui offre les memes "
    "garanties de durabilite et de recuperation que celles dont beneficie la base de donnees.",
    body_style
))

story.append(add_heading('<b>1.2 Objectifs de ce guide</b>', h2_style, level=1))
story.append(Paragraph(
    "Ce guide technique a pour objectif principal de vous accompagner pas a pas dans le deploiement "
    "de MinIO en tant que service de stockage objet compatible S3 au sein de votre infrastructure Coolify. "
    "MinIO est un serveur de stockage objet open source, haute performance, qui offre une compatibilite "
    "complete avec l'API Amazon S3. Cette compatibilite permet d'utiliser n'importe quel SDK ou outil "
    "concu pour S3 sans modification, ce qui facilite considerablement l'integration avec l'application Dalia.",
    body_style
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Les objectifs specifiques couverts par ce guide incluent le deploiement de MinIO en tant que service "
    "Docker sur Coolify, la configuration des buckets et des politiques de securite, l'integration du "
    "client S3 dans le code de l'application Dalia, la mise en place d'une strategie de sauvegarde et "
    "de versionning des fichiers, ainsi que la configuration du monitoring et des alertes pour surveiller "
    "l'espace de stockage disponible. En suivant ce guide, vous disposerez d'une infrastructure de stockage "
    "robuste, securisee et facilement administrable, qui protege les fichiers de Dalia contre les pertes "
    "accidentelles et permet une scalabilite horizontale si les besoins de stockage augmentent.",
    body_style
))

story.append(add_heading('<b>1.3 Pourquoi MinIO ?</b>', h2_style, level=1))
story.append(Paragraph(
    "Le choix de MinIO comme solution de stockage pour Dalia repose sur plusieurs facteurs techniques "
    "et strategiques. Premierement, MinIO offre une compatibilite native avec l'API S3, ce qui signifie "
    "que tous les SDK existants (AWS SDK pour Node.js, Python, Java, Go, etc.) fonctionnent sans "
    "adaptation. Cette compatibilite elimine le risque de verrouillage proprietaire et permet une "
    "migration future vers un autre fournisseur S3 (AWS, Wasabi, Google Cloud Storage) sans modifier "
    "le code applicatif. Deuxiemement, MinIO est concu pour la haute performance avec des debits "
    "pouvant atteindre plusieurs gigaoctets par seconde en lecture et en ecriture, ce qui est plus "
    "que suffisant pour les besoins de Dalia. Troisiemement, MinIO peut etre deploye en mode distribue "
    "pour assurer la tolerance aux pannes et la haute disponibilite.",
    body_style
))
story.append(Spacer(1, 6))

# Comparison table
comp_data = [
    [Paragraph('<b>Critere</b>', tbl_header_style),
     Paragraph('<b>MinIO</b>', tbl_header_style),
     Paragraph('<b>Volume Docker</b>', tbl_header_style),
     Paragraph('<b>S3 Cloud (AWS)</b>', tbl_header_style)],
    [Paragraph('Compatibilite S3', tbl_cell_style),
     Paragraph('Native', tbl_cell_center),
     Paragraph('Non', tbl_cell_center),
     Paragraph('Natif', tbl_cell_center)],
    [Paragraph('Backup automatique', tbl_cell_style),
     Paragraph('Oui (versioning)', tbl_cell_center),
     Paragraph('Non', tbl_cell_center),
     Paragraph('Oui', tbl_cell_center)],
    [Paragraph('Scalabilite', tbl_cell_style),
     Paragraph('Horizontale', tbl_cell_center),
     Paragraph('Verticale seule', tbl_cell_center),
     Paragraph('Illimitee', tbl_cell_center)],
    [Paragraph('Cout', tbl_cell_style),
     Paragraph('Gratuit (self-hosted)', tbl_cell_center),
     Paragraph('Gratuit', tbl_cell_center),
     Paragraph('Payant (usage)', tbl_cell_center)],
    [Paragraph('Administration', tbl_cell_style),
     Paragraph('Console web + CLI', tbl_cell_center),
     Paragraph('Manuelle', tbl_cell_center),
     Paragraph('Console AWS', tbl_cell_center)],
    [Paragraph('Securite', tbl_cell_style),
     Paragraph('IAM + Bucket Policies', tbl_cell_center),
     Paragraph('OS uniquement', tbl_cell_center),
     Paragraph('IAM + Policies', tbl_cell_center)],
]
story.append(Spacer(1, 12))
story.append(make_table(comp_data, col_ratios=[0.28, 0.24, 0.24, 0.24]))
story.append(Paragraph('<i>Tableau 1 : Comparaison des solutions de stockage</i>', caption_style))
story.append(Spacer(1, 18))


# ════════════════════════════════════════════════════════════════
# CHAPTER 2: Architecture de stockage
# ════════════════════════════════════════════════════════════════
story.append(add_heading('<b>2. Architecture de stockage Dalia</b>', h1_style, level=0))
story.append(Spacer(1, 6))

story.append(add_heading('<b>2.1 Architecture actuelle vs. cible</b>', h2_style, level=1))
story.append(Paragraph(
    "L'architecture actuelle de Dalia repose sur un pattern monolithique ou l'application, la base de "
    "donnees et le stockage de fichiers cohabitent sur le meme serveur. Les fichiers uploades sont "
    "ecrits directement dans un volume Docker monte dans le conteneur de l'application. Cette approche "
    "simple presente neanmoins des limites importantes : le volume Docker est lie au serveur physique, "
    "il n'y a pas de mecanisme de replication, et les sauvegardes doivent etre effectuees manuellement "
    "via des scripts ad hoc. De plus, l'acces concurrentiel aux fichiers peut poser des problemes de "
    "performance lorsque plusieurs utilisateurs uploadent ou telechargent des fichiers simultanement.",
    body_style
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "L'architecture cible separe clairement les responsabilites en trois couches distinctes. La couche "
    "de donnees relationnelles est assuree par PostgreSQL avec ses backups automatiques Coolify. La couche "
    "applicative est portee par l'application Dalia, qui communique avec le stockage via l'API S3. Enfin, "
    "la couche de stockage objet est deleguee a MinIO, qui offre le versioning, la replication et une "
    "console d'administration dediee. Cette separation des preoccupations ameliore la resilience globale "
    "du systeme et permet de faire evoluer chaque couche independamment des autres.",
    body_style
))

story.append(add_heading('<b>2.2 Flux de donnees</b>', h2_style, level=1))
story.append(Paragraph(
    "Le flux de donnees typique dans l'architecture cible fonctionne de la maniere suivante. Lorsqu'un "
    "utilisateur uploade un fichier via l'interface de Dalia, l'application recoit le fichier par HTTP, "
    "genere un identifiant unique (UUID) pour le fichier, puis transfere le fichier vers MinIO en utilisant "
    "le SDK S3. L'URL du bucket et la cle d'acces sont configurees via des variables d'environnement. "
    "MinIO stocke le fichier dans le bucket designe et retourne un identifiant d'objet. L'application "
    "enregistre alors dans PostgreSQL les metadonnees du fichier (nom original, type MIME, taille, "
    "chemin S3, date d'upload, utilisateur proprietaire). Pour le telechargement, l'application genere "
    "une URL signee temporaire (pre-signed URL) qui permet a l'utilisateur d'acceder au fichier pendant "
    "une duree limitee sans exposer les identifiants S3.",
    body_style
))

story.append(add_heading('<b>2.3 Composants de l\'infrastructure</b>', h2_style, level=1))
infra_data = [
    [Paragraph('<b>Composant</b>', tbl_header_style),
     Paragraph('<b>Role</b>', tbl_header_style),
     Paragraph('<b>Port</b>', tbl_header_style),
     Paragraph('<b>Backup</b>', tbl_header_style)],
    [Paragraph('Application Dalia', tbl_cell_style),
     Paragraph('Backend + Frontend', tbl_cell_style),
     Paragraph('3000', tbl_cell_center),
     Paragraph('Configuration uniquement', tbl_cell_style)],
    [Paragraph('PostgreSQL', tbl_cell_style),
     Paragraph('Base de donnees relationnelle', tbl_cell_style),
     Paragraph('5432', tbl_cell_center),
     Paragraph('Automatique (Coolify)', tbl_cell_style)],
    [Paragraph('MinIO Server', tbl_cell_style),
     Paragraph('Stockage objet S3', tbl_cell_style),
     Paragraph('9000', tbl_cell_center),
     Paragraph('Versioning + replication', tbl_cell_style)],
    [Paragraph('MinIO Console', tbl_cell_style),
     Paragraph('Administration web', tbl_cell_style),
     Paragraph('9001', tbl_cell_center),
     Paragraph('N/A', tbl_cell_center)],
]
story.append(Spacer(1, 12))
story.append(make_table(infra_data, col_ratios=[0.22, 0.33, 0.12, 0.33]))
story.append(Paragraph('<i>Tableau 2 : Composants de l\'infrastructure Dalia</i>', caption_style))
story.append(Spacer(1, 18))


# ════════════════════════════════════════════════════════════════
# CHAPTER 3: Deploiement de MinIO sur Coolify
# ════════════════════════════════════════════════════════════════
story.append(add_heading('<b>3. Deploiement de MinIO sur Coolify</b>', h1_style, level=0))
story.append(Spacer(1, 6))

story.append(add_heading('<b>3.1 Prerequis</b>', h2_style, level=1))
story.append(Paragraph(
    "Avant de proceder au deploiement de MinIO, assurez-vous que les conditions suivantes sont remplies. "
    "Vous devez disposer d'un serveur Coolify fonctionnel avec acces administrateur. Le serveur doit avoir "
    "au moins 2 Go de RAM disponible pour MinIO (4 Go recommandes pour la production). L'espace disque "
    "doit etre suffisant pour accueillir les fichiers de Dalia avec une marge de croissance previsionnelle. "
    "Les ports 9000 et 9001 doivent etre disponibles et non utilises par d'autres services. Enfin, vous "
    "devez avoir un nom de domaine ou sous-domaine pointant vers votre serveur si vous souhaitez activer "
    "le HTTPS (fortement recommande en production).",
    body_style
))

story.append(add_heading('<b>3.2 Deploiement via Docker Compose</b>', h2_style, level=1))
story.append(Paragraph(
    "La methode recommandee pour deployer MinIO sur Coolify consiste a utiliser un service Docker Compose "
    "personnalise. Dans l'interface Coolify, naviguez vers votre projet, puis ajoutez un nouveau service "
    "en selectionnant l'option 'Docker Compose'. Collez la configuration suivante dans l'editeur. "
    "Cette configuration definit deux services : le serveur MinIO qui gere le stockage objet sur le port "
    "9000, et la console d'administration accessible sur le port 9001. Les volumes persistants assurent "
    "que les donnees survivent aux redemarrages du conteneur, et les variables d'environnement definissent "
    "les identifiants d'acces root ainsi que la strategie de mot de passe.",
    body_style
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "version: '3.8'<br/>"
    "services:<br/>"
    "&nbsp;&nbsp;minio:<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;image: minio/minio:latest<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;container_name: dalia-minio<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;ports:<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- '9000:9000'<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- '9001:9001'<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;environment:<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MINIO_ROOT_USER: dalia_admin<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MINIO_ROOT_PASSWORD: &lt;mot_de_passe_securise&gt;<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;volumes:<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- minio_data:/data<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;command: server /data --console-address ':9001'<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;restart: unless-stopped<br/>"
    "&nbsp;&nbsp;volumes:<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;minio_data:",
    code_style
))
story.append(Spacer(1, 8))
story.append(add_note(
    "Note : Remplacez &lt;mot_de_passe_securise&gt; par un mot de passe robuste d'au moins 16 caracteres. "
    "Il est recommande d'utiliser un gestionnaire de mots de passe pour generer cette valeur."
))
story.append(Spacer(1, 12))

story.append(add_heading('<b>3.3 Configuration dans Coolify</b>', h2_style, level=1))
story.append(Paragraph(
    "Une fois le Docker Compose configure, suivez ces etapes dans l'interface Coolify pour finaliser "
    "le deploiement. Premierement, apres avoir colle la configuration, Coolify va analyser le fichier "
    "et detecter automatiquement les services. Verifiez que les ports 9000 et 9001 sont correctement "
    "mappes. Deuxiemement, dans la section des variables d'environnement, vous pouvez soit utiliser "
    "les valeurs du Docker Compose directement, soit les surcharger via l'interface Coolify en utilisant "
    "les variables d'environnement du projet. Cette deuxieme approche est preferable car elle permet "
    "de gerer les secrets de maniere centralisee et de ne pas les commit dans le fichier Compose.",
    body_style
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Troisiemement, configurez le reseau Docker pour que MinIO soit accessible depuis l'application Dalia. "
    "Dans Coolify, les services du meme projet sont generalement places dans le meme reseau Docker, "
    "ce qui permet une communication directe via les noms de service. Assurez-vous que le service MinIO "
    "et l'application Dalia partagent le meme reseau. Quatriemement, si vous utilisez un reverse proxy "
    "(Nginx, Traefik) configure via Coolify, ajoutez les entrees pour les domaines de MinIO et de la "
    "console. Activez le HTTPS avec Let's Encrypt pour les deux domaines. Cinquiemement, lancez le "
    "deploiement et verifiez dans les logs que MinIO demarre correctement et que la console est "
    "accessible a l'adresse configuree.",
    body_style
))

story.append(add_heading('<b>3.4 Verification du deploiement</b>', h2_style, level=1))
story.append(Paragraph(
    "Apres le deploiement, effectuez les verifications suivantes pour vous assurer que MinIO fonctionne "
    "correctement. Ouvrez la console MinIO dans votre navigateur en accedant a l'URL configuree "
    "(par exemple https://minio-console.votre-domaine.com). Connectez-vous avec les identifiants "
    "root definis dans les variables d'environnement. Si la connexion reussit et que vous voyez le "
    "tableau de bord MinIO, le serveur est operationnel. Vous pouvez egalement verifier la sante du "
    "service via l'endpoint de health check en envoyant une requete HTTP GET sur le port 9000 avec "
    "le chemin /minio/health/live. Un code de retour 200 indique que le service est en bonne sante.",
    body_style
))


# ════════════════════════════════════════════════════════════════
# CHAPTER 4: Configuration et securite
# ════════════════════════════════════════════════════════════════
story.append(add_heading('<b>4. Configuration et securite</b>', h1_style, level=0))
story.append(Spacer(1, 6))

story.append(add_heading('<b>4.1 Creation des buckets</b>', h2_style, level=1))
story.append(Paragraph(
    "Les buckets sont les conteneurs fondamentaux du stockage objet S3. Pour Dalia, nous recommandons "
    "de creer au minimum deux buckets distincts pour separer les types de fichiers et appliquer des "
    "politiques de retention differentes. Le bucket 'dalia-documents' contiendra les fichiers PDF et "
    "documents administratifs qui necessitent une retention a long terme et un versionning strict. "
    "Le bucket 'dalia-media' contiendra les images et fichiers multimedia qui peuvent avoir une "
    "politique de retention plus flexible. Cette separation permet d'appliquer des quotas differents, "
    "des politiques de cycle de vie distinctes, et de gerer les permissions de maniere granulaire.",
    body_style
))
story.append(Spacer(1, 6))

bucket_data = [
    [Paragraph('<b>Bucket</b>', tbl_header_style),
     Paragraph('<b>Contenu</b>', tbl_header_style),
     Paragraph('<b>Versioning</b>', tbl_header_style),
     Paragraph('<b>Retention</b>', tbl_header_style)],
    [Paragraph('dalia-documents', tbl_cell_style),
     Paragraph('PDF, documents admin', tbl_cell_style),
     Paragraph('Active', tbl_cell_center),
     Paragraph('90 jours (versions)', tbl_cell_style)],
    [Paragraph('dalia-media', tbl_cell_style),
     Paragraph('Images, fichiers media', tbl_cell_style),
     Paragraph('Active', tbl_cell_center),
     Paragraph('30 jours (versions)', tbl_cell_style)],
    [Paragraph('dalia-backups', tbl_cell_style),
     Paragraph('Sauvegardes exportees', tbl_cell_style),
     Paragraph('Desactive', tbl_cell_center),
     Paragraph('7 jours', tbl_cell_style)],
]
story.append(Spacer(1, 12))
story.append(make_table(bucket_data, col_ratios=[0.22, 0.30, 0.18, 0.30]))
story.append(Paragraph('<i>Tableau 3 : Configuration des buckets Dalia</i>', caption_style))
story.append(Spacer(1, 18))

story.append(Paragraph(
    "Pour creer ces buckets, vous pouvez utiliser la console MinIO ou l'outil en ligne de commande mc "
    "(MinIO Client). Via la console, connectez-vous et cliquez sur 'Create Bucket' dans la section "
    "Buckets. Via mc, les commandes sont les suivantes : configurez d'abord l'alias du serveur avec "
    "mc alias set dalia http://minio:9000 dalia_admin &lt;mot_de_passe&gt;, puis creez les buckets "
    "avec mc mb dalia/dalia-documents, mc mb dalia/dalia-media, et mc mb dalia/dalia-backups. "
    "Activez le versioning avec mc version enable dalia/dalia-documents et de meme pour les autres "
    "buckets selon le tableau ci-dessus.",
    body_style
))

story.append(add_heading('<b>4.2 Politiques de securite et IAM</b>', h2_style, level=1))
story.append(Paragraph(
    "La securite de MinIO repose sur un systeme IAM (Identity and Access Management) similaire a celui "
    "d'AWS. Il est crucial de ne jamais utiliser les identifiants root dans l'application Dalia. "
    "A la place, creez des utilisateurs dedies avec des permissions minimales suivant le principe du "
    "moindre privilege. Pour Dalia, nous recommandons de creer deux utilisateurs distincts : un utilisateur "
    "'dalia-app' avec un acces en lecture/ecriture sur les buckets necessaires, et un utilisateur "
    "'dalia-backup' avec un acces en lecture seule pour les operations de sauvegarde. Chaque utilisateur "
    "se verra attribuer une politique IAM specifique qui limite strictement les actions autorisees.",
    body_style
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Les politiques IAM sont definies au format JSON et attachees aux utilisateurs. La politique pour "
    "'dalia-app' autorise les operations GetObject, PutObject, DeleteObject, et ListBucket sur les "
    "buckets dalia-documents et dalia-media. La politique pour 'dalia-backup' autorise uniquement "
    "GetObject et ListBucket sur tous les buckets. Ces politiques garantissent que meme si les "
    "identifiants de l'application sont compromises, l'attaquant ne pourra pas acceder aux buckets "
    "de sauvegarde ni effectuer d'operations destructrices sur les donnees archives.",
    body_style
))

story.append(add_heading('<b>4.3 Chiffrement et HTTPS</b>', h2_style, level=1))
story.append(Paragraph(
    "Le chiffrement des donnees en transit et au repos est essentiel pour la protection des fichiers "
    "sensibles. Pour le chiffrement en transit, configurez le HTTPS sur le reverse proxy (Traefik ou "
    "Nginx) via Coolify avec des certificats Let's Encrypt. Cela garantit que toutes les communications "
    "entre les clients et MinIO sont chiffrees. Pour le chiffrement au repos, MinIO supporte le "
    "chiffrement automatique des objets (Server-Side Encryption) en utilisant soit une cle KMS externe, "
    "soit une cle de chiffrement statique definie via la variable d'environnement MINIO_KMS_SECRET_KEY. "
    "En production, il est recommande d'utiliser une cle KMS externe comme HashiCorp Vault pour une "
    "gestion plus securisee des cles de chiffrement.",
    body_style
))


# ════════════════════════════════════════════════════════════════
# CHAPTER 5: Integration avec l'application Dalia
# ════════════════════════════════════════════════════════════════
story.append(add_heading('<b>5. Integration avec l\'application Dalia</b>', h1_style, level=0))
story.append(Spacer(1, 6))

story.append(add_heading('<b>5.1 Variables d\'environnement</b>', h2_style, level=1))
story.append(Paragraph(
    "L'integration de MinIO dans l'application Dalia commence par la configuration des variables "
    "d'environnement. Ces variables permettent a l'application de se connecter au serveur MinIO "
    "sans hardcoder les identifiants dans le code source. Ajoutez les variables suivantes dans la "
    "configuration du service Dalia dans Coolify. L'utilisation de variables d'environnement est "
    "une bonne pratique fondamentale qui facilite la rotation des identifiants, la migration entre "
    "environnements (developpement, staging, production) et le respect des politiques de securite.",
    body_style
))
story.append(Spacer(1, 6))

env_data = [
    [Paragraph('<b>Variable</b>', tbl_header_style),
     Paragraph('<b>Description</b>', tbl_header_style),
     Paragraph('<b>Exemple</b>', tbl_header_style)],
    [Paragraph('S3_ENDPOINT', tbl_cell_style),
     Paragraph('URL du serveur MinIO', tbl_cell_style),
     Paragraph('http://dalia-minio:9000', tbl_cell_style)],
    [Paragraph('S3_ACCESS_KEY', tbl_cell_style),
     Paragraph('Cle d\'acces IAM', tbl_cell_style),
     Paragraph('dalia-app', tbl_cell_style)],
    [Paragraph('S3_SECRET_KEY', tbl_cell_style),
     Paragraph('Cle secrete IAM', tbl_cell_style),
     Paragraph('&lt;cle_secrete&gt;', tbl_cell_style)],
    [Paragraph('S3_BUCKET_DOCS', tbl_cell_style),
     Paragraph('Bucket documents', tbl_cell_style),
     Paragraph('dalia-documents', tbl_cell_style)],
    [Paragraph('S3_BUCKET_MEDIA', tbl_cell_style),
     Paragraph('Bucket media', tbl_cell_style),
     Paragraph('dalia-media', tbl_cell_style)],
    [Paragraph('S3_REGION', tbl_cell_style),
     Paragraph('Region (fictive)', tbl_cell_style),
     Paragraph('us-east-1', tbl_cell_style)],
]
story.append(Spacer(1, 12))
story.append(make_table(env_data, col_ratios=[0.28, 0.40, 0.32]))
story.append(Paragraph('<i>Tableau 4 : Variables d\'environnement pour l\'integration S3</i>', caption_style))
story.append(Spacer(1, 18))

story.append(add_heading('<b>5.2 Configuration du client S3 (Node.js)</b>', h2_style, level=1))
story.append(Paragraph(
    "Si l'application Dalia est developpee en Node.js, utilisez le SDK AWS officiel (version 3) pour "
    "interagir avec MinIO. La configuration du client S3 est directe grace a la compatibilite native "
    "de l'API. Il suffit de specifier l'endpoint MinIO et de desactiver la resolution DNS du bucket "
    "qui est specifique a AWS. Le code suivant montre comment configurer le client S3, uploader un "
    "fichier, generer une URL signee pour le telechargement, et supprimer un fichier. Chaque operation "
    "est asynchrone et gere les erreurs de maniere appropriee pour assurer la robustesse de l'application.",
    body_style
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand }<br/>"
    "&nbsp;&nbsp;from '@aws-sdk/client-s3';<br/>"
    "import { getSignedUrl } from '@aws-sdk/s3-request-presigner';<br/><br/>"
    "const s3 = new S3Client({<br/>"
    "&nbsp;&nbsp;endpoint: process.env.S3_ENDPOINT,<br/>"
    "&nbsp;&nbsp;region: process.env.S3_REGION || 'us-east-1',<br/>"
    "&nbsp;&nbsp;credentials: {<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;accessKeyId: process.env.S3_ACCESS_KEY,<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;secretAccessKey: process.env.S3_SECRET_KEY,<br/>"
    "&nbsp;&nbsp;},<br/>"
    "&nbsp;&nbsp;forcePathStyle: true,  // Requis pour MinIO<br/>"
    "});",
    code_style
))
story.append(Spacer(1, 8))

story.append(add_heading('<b>5.3 Upload et download de fichiers</b>', h2_style, level=1))
story.append(Paragraph(
    "L'upload d'un fichier vers MinIO se fait en deux temps : d'abord le transfert du fichier vers "
    "le bucket S3, puis l'enregistrement des metadonnees dans PostgreSQL. Cette approche garantit que "
    "chaque fichier est reference dans la base de donnees avec son chemin S3, ce qui facilite les "
    "recherches et les filtres. Le code d'upload utilise la commande PutObjectCommand du SDK, en "
    "spécifiant le bucket, la cle (chemin du fichier dans le bucket), le corps du fichier (Buffer ou "
    "Stream), et le type MIME. Pour le telechargement, la strategie recommandee est de generer une "
    "URL signee temporaire (pre-signed URL) valide pendant une duree definie (par exemple 15 minutes). "
    "Cette approche evite de faire transiter les fichiers par le serveur applicatif, ce qui reduit la "
    "charge et ameliore les performances. L'utilisateur est redirige directement vers l'URL signee qui "
    "pointe vers MinIO.",
    body_style
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "// Upload d'un fichier<br/>"
    "async function uploadFile(bucket, key, body, contentType) {<br/>"
    "&nbsp;&nbsp;await s3.send(new PutObjectCommand({<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;Bucket: bucket,<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;Key: key,<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;Body: body,<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;ContentType: contentType,<br/>"
    "&nbsp;&nbsp;}));<br/>"
    "}",
    code_style
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "// Generation d'une URL signee<br/>"
    "async function getDownloadUrl(bucket, key, expiresInSeconds = 900) {<br/>"
    "&nbsp;&nbsp;const command = new GetObjectCommand({ Bucket: bucket, Key: key });<br/>"
    "&nbsp;&nbsp;return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });<br/>"
    "}",
    code_style
))
story.append(Spacer(1, 12))

story.append(add_heading('<b>5.4 Gestion des erreurs et retry</b>', h2_style, level=1))
story.append(Paragraph(
    "La communication avec MinIO peut echouer pour diverses raisons : indisponibilite temporaire du "
    "service, saturation du reseau, depassement du quota, ou erreurs de permission. Il est essentiel "
    "d'implementer une strategie de retry avec backoff exponentiel pour les operations critiques comme "
    "l'upload de fichiers. Le SDK AWS v3 pour Node.js inclut un middleware de retry natif qui peut "
    "etre configure avec un nombre maximal de tentatives et un delai de backoff. Pour les erreurs "
    "non recuperables (acces refuse, bucket inexistant), l'application doit logger l'erreur avec le "
    "maximum de contexte et notifier l'utilisateur de maniere appropriee. Il est recommande d'implementer "
    "un circuit breaker qui desactive temporairement les appels S3 si le taux d'erreur depasse un seuil "
    "configurable, afin de proteger l'application contre les cascades de pannes.",
    body_style
))


# ════════════════════════════════════════════════════════════════
# CHAPTER 6: Strategie de sauvegarde et replication
# ════════════════════════════════════════════════════════════════
story.append(add_heading('<b>6. Strategie de sauvegarde et replication</b>', h1_style, level=0))
story.append(Spacer(1, 6))

story.append(add_heading('<b>6.1 Versioning des objets</b>', h2_style, level=1))
story.append(Paragraph(
    "Le versioning S3 est le premier niveau de protection contre les suppressions accidentelles et les "
    "ecrasements de fichiers. Lorsque le versioning est active sur un bucket, chaque modification d'un "
    "objet cree une nouvelle version tout en conservant les versions precedentes. Si un utilisateur "
    "supprime un fichier par erreur, il est possible de restaurer la version precedente en quelques "
    "clics depuis la console MinIO ou via l'API. Le versioning est active par bucket et peut etre "
    "configure independamment pour chaque bucket. Pour Dalia, nous recommandons d'activer le versioning "
    "sur les buckets dalia-documents et dalia-media. Le bucket dalia-backups n'a pas besoin de "
    "versioning car il contient deja des copies de sauvegarde.",
    body_style
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "La gestion du cycle de vie des versions est importante pour eviter une croissance illimitee du "
    "stockage. MinIO supporte les regles de cycle de vie (Lifecycle Rules) qui permettent de supprimer "
    "automatiquement les anciennes versions apres une periode definie. Par exemple, vous pouvez "
    "configurer une regle qui conserve les 10 dernieres versions de chaque fichier dans dalia-documents, "
    "ou qui supprime les versions plus anciennes que 90 jours dans dalia-media. Ces regles sont "
    "definies au format JSON et appliquees au bucket via mc ou l'API S3.",
    body_style
))

story.append(add_heading('<b>6.2 Replication inter-buckets</b>', h2_style, level=1))
story.append(Paragraph(
    "Pour une protection supplementaire contre la perte de donnees, MinIO supporte la replication "
    "inter-sites (site replication) qui permet de replicer les objets d'une instance MinIO vers une "
    "autre instance distante. En configuration minimale, vous pouvez configurer une replication entre "
    "deux instances MinIO situees sur des serveurs differents ou dans des datacenters distincts. "
    "Si le serveur principal devient indisponible, les donnees restent accessibles sur le serveur "
    "de replication. La replication est asynchrone, ce qui signifie qu'il peut y avoir un delai "
    "court entre l'ecriture sur le serveur principal et la replication sur le serveur secondaire. "
    "Pour la plupart des cas d'usage de Dalia, ce delai est acceptable car les fichiers ne sont "
    "generalement pas modifies de maniere concurrente par plusieurs utilisateurs.",
    body_style
))

story.append(add_heading('<b>6.3 Script de sauvegarde automatique</b>', h2_style, level=1))
story.append(Paragraph(
    "En complement du versioning et de la replication, il est recommande de mettre en place un script "
    "de sauvegarde automatique qui exporte regulierement les fichiers de MinIO vers un emplacement "
    "externe. Ce script peut utiliser mc mirror pour synchroniser le contenu des buckets vers un "
    "autre serveur MinIO, un bucket S3 cloud (AWS, Wasabi), ou un stockage local. Le script doit "
    "etre execute via un cron job (par exemple, toutes les nuits a 2h du matin) et doit logger ses "
    "operations pour permettre le suivi et le diagnostic en cas de probleme. Voici un exemple de "
    "script de sauvegarde minimaliste qui peut etre adapte a vos besoins specifiques.",
    body_style
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "#!/bin/bash<br/>"
    "# Script de sauvegarde MinIO pour Dalia<br/>"
    "DATE=$(date +%Y%m%d_%H%M%S)<br/>"
    "LOG_FILE=/var/log/minio-backup.log<br/><br/>"
    "echo \"[$DATE] Debut de la sauvegarde\" >> $LOG_FILE<br/><br/>"
    "# Synchronisation vers le stockage secondaire<br/>"
    "mc mirror dalia/dalia-documents /backup/dalia-documents/ \\<br/>"
    "&nbsp;&nbsp;--overwrite --remove >> $LOG_FILE 2>&amp;1<br/>"
    "mc mirror dalia/dalia-media /backup/dalia-media/ \\<br/>"
    "&nbsp;&nbsp;--overwrite --remove >> $LOG_FILE 2>&amp;1<br/><br/>"
    "echo \"[$DATE] Sauvegarde terminee\" >> $LOG_FILE",
    code_style
))
story.append(Spacer(1, 12))


# ════════════════════════════════════════════════════════════════
# CHAPTER 7: Monitoring et maintenance
# ════════════════════════════════════════════════════════════════
story.append(add_heading('<b>7. Monitoring et maintenance</b>', h1_style, level=0))
story.append(Spacer(1, 6))

story.append(add_heading('<b>7.1 Metriques et surveillance</b>', h2_style, level=1))
story.append(Paragraph(
    "MinIO expose nativement des metriques au format Prometheus via l'endpoint /minio/v2/metrics/cluster. "
    "Ces metriques incluent l'utilisation du disque, le nombre d'objets stockes, le debit de lecture et "
    "d'ecriture, le nombre de requetes en cours, et le taux d'erreurs. Si vous utilisez Prometheus et "
    "Grafana dans votre infrastructure, vous pouvez configurer Prometheus pour scraper les metriques de "
    "MinIO et creer des tableaux de bord Grafana pour visualiser l'etat du stockage en temps reel. "
    "Coolify permet d'ajouter facilement des services complementaires comme Prometheus et Grafana dans "
    "le meme environnement Docker, ce qui facilite la mise en place de cette chaine de surveillance.",
    body_style
))
story.append(Spacer(1, 6))

metrics_data = [
    [Paragraph('<b>Metrique</b>', tbl_header_style),
     Paragraph('<b>Description</b>', tbl_header_style),
     Paragraph('<b>Alerte recommandee</b>', tbl_header_style)],
    [Paragraph('disk_used_percent', tbl_cell_style),
     Paragraph('Pourcentage d\'utilisation disque', tbl_cell_style),
     Paragraph('> 80% WARNING, > 90% CRITICAL', tbl_cell_style)],
    [Paragraph('objects_count', tbl_cell_style),
     Paragraph('Nombre total d\'objets', tbl_cell_style),
     Paragraph('Croissance anormale', tbl_cell_style)],
    [Paragraph('api_requests_total', tbl_cell_style),
     Paragraph('Nombre de requetes API', tbl_cell_style),
     Paragraph('Taux d\'erreur > 5%', tbl_cell_style)],
    [Paragraph('network_sent_bytes', tbl_cell_style),
     Paragraph('Donnees envoyees', tbl_cell_style),
     Paragraph('Debit inhabituel', tbl_cell_style)],
    [Paragraph('heal_objects_heal', tbl_cell_style),
     Paragraph('Objets en cours de reparation', tbl_cell_style),
     Paragraph('> 0 pendant > 1h', tbl_cell_style)],
]
story.append(Spacer(1, 12))
story.append(make_table(metrics_data, col_ratios=[0.25, 0.40, 0.35]))
story.append(Paragraph('<i>Tableau 5 : Metriques MinIO cles et alertes recommandees</i>', caption_style))
story.append(Spacer(1, 18))

story.append(add_heading('<b>7.2 Alertes et notifications</b>', h2_style, level=1))
story.append(Paragraph(
    "La configuration des alertes est essentielle pour reagir rapidement en cas de probleme. MinIO "
    "supporte les notifications d'evenements via plusieurs canaux : webhooks, AMQP, Kafka, Redis, et "
    "Elasticsearch. Pour Dalia, la methode la plus simple consiste a configurer un webhook qui envoie "
    "les notifications d'evenements importants (creation, suppression, erreur de healing) vers un "
    "service de notification interne. Vous pouvez egalement utiliser les alertes de Prometheus via "
    "Alertmanager pour envoyer des notifications par email, Slack, ou tout autre canal when les "
    "metriques depassent les seuils definis. Il est recommande de configurer au minimum une alerte "
    "sur l'utilisation disque superieure a 80% et une alerte sur le taux d'erreur API superieur a 5%.",
    body_style
))

story.append(add_heading('<b>7.3 Maintenance courante</b>', h2_style, level=1))
story.append(Paragraph(
    "La maintenance de MinIO comprend plusieurs taches regulieres qui assurent le bon fonctionnement "
    "du systeme sur le long terme. Premierement, verifiez regulierement l'utilisation du disque via la "
    "console MinIO ou les metriques Prometheus. Si l'utilisation approche les 80%, envisagez d'ajouter "
    "de l'espace de stockage ou de nettoyer les anciennes versions. Deuxiemement, executez "
    "periodiquement la commande mc admin heal pour verifier l'integrite des objets stockes et "
    "reparer les eventuelles corruptions. Cette commande compare les checksums des objets et "
    "restaure les copies corrompues a partir des replicas sains. Troisiemement, mettez a jour "
    "MinIO regulierement en utilisant les mises a jour fournies par Coolify. Les mises a jour de "
    "MinIO sont generalement retrocompatibles et n'entrainent pas de perte de donnees.",
    body_style
))
story.append(Spacer(1, 6))

maint_data = [
    [Paragraph('<b>Tache</b>', tbl_header_style),
     Paragraph('<b>Frequence</b>', tbl_header_style),
     Paragraph('<b>Commande / Action</b>', tbl_header_style)],
    [Paragraph('Verification disque', tbl_cell_style),
     Paragraph('Quotidienne', tbl_cell_center),
     Paragraph('mc admin info dalia', tbl_cell_style)],
    [Paragraph('Heal check', tbl_cell_style),
     Paragraph('Hebdomadaire', tbl_cell_center),
     Paragraph('mc admin heal dalia', tbl_cell_style)],
    [Paragraph('Nettoyage versions', tbl_cell_style),
     Paragraph('Mensuelle', tbl_cell_center),
     Paragraph('mc rm --older-than 90d', tbl_cell_style)],
    [Paragraph('Mise a jour MinIO', tbl_cell_style),
     Paragraph('Trimestrielle', tbl_cell_center),
     Paragraph('Via Coolify (pull new image)', tbl_cell_style)],
    [Paragraph('Rotation cles IAM', tbl_cell_style),
     Paragraph('Trimestrielle', tbl_cell_center),
     Paragraph('mc admin user svcacct', tbl_cell_style)],
    [Paragraph('Test de restauration', tbl_cell_style),
     Paragraph('Semestrielle', tbl_cell_center),
     Paragraph('Restaurer un fichier de backup', tbl_cell_style)],
]
story.append(Spacer(1, 12))
story.append(make_table(maint_data, col_ratios=[0.25, 0.20, 0.55]))
story.append(Paragraph('<i>Tableau 6 : Plan de maintenance MinIO</i>', caption_style))
story.append(Spacer(1, 18))


# ════════════════════════════════════════════════════════════════
# CHAPTER 8: Plan de migration
# ════════════════════════════════════════════════════════════════
story.append(add_heading('<b>8. Plan de migration</b>', h1_style, level=0))
story.append(Spacer(1, 6))

story.append(add_heading('<b>8.1 Evaluation des fichiers existants</b>', h2_style, level=1))
story.append(Paragraph(
    "Avant de lancer la migration des fichiers existants vers MinIO, il est essentiel d'evaluer le "
    "volume et la nature des fichiers actuellement stockes dans les volumes Docker de Dalia. Commencez "
    "par identifier le volume Docker qui contient les fichiers uploades en utilisant la commande "
    "docker inspect sur le conteneur Dalia. Ensuite, calculez la taille totale des fichiers avec "
    "du -sh sur le point de montage du volume. Inventoriez les types de fichiers presents (PDF, images, "
    "documents Office) et leur repartition par taille et par nombre. Cette evaluation vous permettra "
    "d'estimer le temps necessaire a la migration et de planifier la capacite de stockage requise "
    "sur MinIO. Prevoyez egalement une marge de croissance d'au moins 50% pour les deux prochaines annees.",
    body_style
))

story.append(add_heading('<b>8.2 Etapes de migration</b>', h2_style, level=1))
story.append(Paragraph(
    "La migration des fichiers existants vers MinIO doit etre effectuee de maniere methodique pour "
    "minimiser les risques de perte de donnees et d'interruption de service. Le processus se deroule "
    "en cinq etapes principales. Premierement, deployez MinIO et configurez les buckets comme decrit "
    "dans les chapitres precedents. Deuxiemement, mettez l'application Dalia en mode maintenance pour "
    "empecher les nouveaux uploads pendant la migration. Troisiemement, copiez les fichiers existants "
    "du volume Docker vers MinIO en utilisant mc mirror ou un script ad hoc qui preserve l'arborescence "
    "des fichiers. Quatriemement, mettez a jour les enregistrements dans la base de donnees PostgreSQL "
    "pour pointer vers les nouveaux chemins S3 au lieu des anciens chemins de fichiers locaux. "
    "Cinquiemement, validez la migration en verifiant que tous les fichiers sont accessibles via MinIO "
    "et que l'application fonctionne correctement avec le nouveau stockage.",
    body_style
))
story.append(Spacer(1, 6))

mig_data = [
    [Paragraph('<b>Etape</b>', tbl_header_style),
     Paragraph('<b>Action</b>', tbl_header_style),
     Paragraph('<b>Duree estimee</b>', tbl_header_style),
     Paragraph('<b>Rollback</b>', tbl_header_style)],
    [Paragraph('1', tbl_cell_center),
     Paragraph('Deploiement MinIO', tbl_cell_style),
     Paragraph('30 min', tbl_cell_center),
     Paragraph('Supprimer le service', tbl_cell_style)],
    [Paragraph('2', tbl_cell_center),
     Paragraph('Mode maintenance Dalia', tbl_cell_style),
     Paragraph('5 min', tbl_cell_center),
     Paragraph('Desactiver le mode', tbl_cell_style)],
    [Paragraph('3', tbl_cell_center),
     Paragraph('Copie des fichiers', tbl_cell_style),
     Paragraph('1-4h (selon volume)', tbl_cell_center),
     Paragraph('Conserver l\'original', tbl_cell_style)],
    [Paragraph('4', tbl_cell_center),
     Paragraph('Mise a jour BDD', tbl_cell_style),
     Paragraph('15-30 min', tbl_cell_center),
     Paragraph('Restaurer le backup BDD', tbl_cell_style)],
    [Paragraph('5', tbl_cell_center),
     Paragraph('Validation et bascule', tbl_cell_style),
     Paragraph('30 min', tbl_cell_center),
     Paragraph('Revenir au stockage local', tbl_cell_style)],
]
story.append(Spacer(1, 12))
story.append(make_table(mig_data, col_ratios=[0.08, 0.30, 0.25, 0.37]))
story.append(Paragraph('<i>Tableau 7 : Plan de migration detaille</i>', caption_style))
story.append(Spacer(1, 18))

story.append(add_heading('<b>8.3 Validation post-migration</b>', h2_style, level=1))
story.append(Paragraph(
    "Apres la migration, il est crucial de valider que tous les fichiers ont ete correctement transferes "
    "et que l'application fonctionne normalement avec MinIO. Effectuez les verifications suivantes dans "
    "l'ordre : comparez le nombre de fichiers dans le volume Docker original et dans MinIO pour vous "
    "assurer qu'aucun fichier n'a ete omis ; verifiez la taille totale des donnees pour detecter les "
    "corruptions potentielles ; testez l'upload d'un nouveau fichier via l'interface Dalia et confirmez "
    "qu'il apparait dans MinIO ; testez le telechargement de plusieurs fichiers de types differents ; "
    "verifiez que les URL signees fonctionnent correctement ; et enfin, demandez a quelques utilisateurs "
    "de tester les fonctionnalites de gestion de fichiers. Ne supprimez jamais les fichiers originaux "
    "du volume Docker avant d'avoir confirme que la migration est un succes complet. Conservez les "
    "fichiers originaux pendant au moins 30 jours en backup de precaution.",
    body_style
))


# ━━ Build Document ━━
doc.multiBuild(story)
print(f"Body PDF generated: {OUTPUT_PATH}")
