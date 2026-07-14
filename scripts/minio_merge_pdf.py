#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Merge cover + body PDFs into final document with metadata."""

from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89

COVER_PDF = '/home/z/my-project/download/minio_cover.pdf'
BODY_PDF = '/home/z/my-project/download/minio_coolify_guide_body.pdf'
OUTPUT_PDF = '/home/z/my-project/download/Guide_MinIO_Coolify_Dalia.pdf'

def normalize_page_to_a4(page):
    """Scale a page to A4 if its dimensions don't match."""
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - A4_W) > 1 or abs(h - A4_H) > 1:
        page.scale_to(A4_W, A4_H)
    # Also explicitly set the media box to exact A4
    page.mediabox.lower_left = (0, 0)
    page.mediabox.upper_right = (A4_W, A4_H)
    return page

def insert_cover(cover_pdf, body_pdf, output_pdf):
    """Insert cover as first page of body PDF -> single output file."""
    writer = PdfWriter()
    # Cover as page 1
    cover_page = PdfReader(cover_pdf).pages[0]
    writer.add_page(normalize_page_to_a4(cover_page))
    # Body pages follow
    for page in PdfReader(body_pdf).pages:
        writer.add_page(normalize_page_to_a4(page))
    writer.add_metadata({
        '/Title': 'Guide de Deploiement MinIO sur Coolify - Projet Dalia',
        '/Author': 'Z.ai',
        '/Creator': 'Z.ai',
        '/Subject': 'Guide technique pour le deploiement de MinIO sur Coolify pour le stockage des fichiers du projet Dalia',
    })
    with open(output_pdf, 'wb') as f:
        writer.write(f)
    print(f"Final PDF generated: {output_pdf}")

if __name__ == '__main__':
    insert_cover(COVER_PDF, BODY_PDF, OUTPUT_PDF)
