"""Synthetic receipts with known ground truth, for the extraction eval.

Each case targets one difficulty (`kind`, the first tag) so a failure says what broke.
The ground truth comes from this generator, never from a model. Everything is seeded,
so regenerating gives byte-identical labels. All businesses are fictional.
"""

import datetime
import random
import re
import unicodedata
from dataclasses import dataclass

from evals.render import Layout

SEED = 2026


def ascii_fold(text: str) -> str:
    """Pillow's built-in font has no accented glyphs, and many thermal printers don't either:
    receipts print "PAO DE OURO" and "EUR". Ground truth follows what is printed."""
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()


@dataclass(frozen=True)
class Locale:
    code: str
    lang: str
    currency: str
    prefix: str
    suffix: str
    thousands: str
    decimal: str
    date_format: str  # uses {d} {m} {y}
    total: str
    subtotal: str
    tax: str | None  # tax added on top (US style), or None when prices include it
    tip: str
    discount: str
    cash: str
    change: str
    thanks: str
    scale: int  # rough price level, so amounts look plausible in each currency

    def money(self, minor: int) -> str:
        whole, cents = divmod(minor, 100)
        grouped = f"{whole:,}".replace(",", self.thousands)
        return f"{self.prefix}{grouped}{self.decimal}{cents:02d}{self.suffix}"

    def date(self, day: datetime.date) -> str:
        return self.date_format.format(d=f"{day.day:02d}", m=f"{day.month:02d}", y=day.year)


LOCALES: dict[str, Locale] = {
    "BR": Locale("BR", "pt", "BRL", "R$ ", "", ".", ",", "{d}/{m}/{y}", "TOTAL", "Subtotal",
                 None, "Taxa de servico 10%", "Desconto", "Dinheiro", "Troco", "Obrigado!", 5),
    "US": Locale("US", "en", "USD", "$", "", ",", ".", "{m}/{d}/{y}", "TOTAL", "Subtotal",
                 "Sales tax 8.25%", "Tip", "Discount", "Cash", "Change", "Thank you!", 1),
    "PT": Locale("PT", "pt", "EUR", "", " EUR", ".", ",", "{d}-{m}-{y}", "TOTAL", "Subtotal",
                 None, "Gorjeta", "Desconto", "Numerario", "Troco", "Obrigado pela visita", 1),
    "DE": Locale("DE", "de", "EUR", "", " EUR", ".", ",", "{d}.{m}.{y}", "SUMME", "Zwischensumme",
                 None, "Trinkgeld", "Rabatt", "Bar", "Rückgeld", "Vielen Dank!", 1),
    "MX": Locale("MX", "es", "MXN", "$", "", ",", ".", "{d}/{m}/{y}", "TOTAL", "Subtotal",
                 None, "Propina", "Descuento", "Efectivo", "Cambio", "¡Gracias por su visita!", 18),
}  # fmt: skip

MERCHANTS: dict[str, dict[str, list[str]]] = {
    "MEALS": {
        "BR": ["Padaria Pão de Ouro", "Restaurante Sabor da Serra", "Café Bela Vista"],
        "US": ["Bluebird Diner", "Copper Kettle Cafe", "Maple Street Grill"],
        "PT": ["Pastelaria Doce Lar", "Tasca do Rio"],
        "DE": ["Bäckerei Sonnenkorn", "Gasthaus Lindenhof"],
        "MX": ["Taquería El Faro", "Café La Brisa"],
    },
    "LODGING": {
        "BR": ["Pousada Mar Azul", "Hotel Serra Verde"],
        "US": ["Harbor Inn", "Redwood Lodge"],
        "PT": ["Hotel Miradouro"],
        "DE": ["Hotel Am Stadtpark"],
        "MX": ["Hotel Casa Coral"],
    },
    "TRAVEL": {
        "BR": ["Viação Horizonte", "Táxi Rápido Cooperativa"],
        "US": ["Metro Cab Co.", "Coastline Shuttle"],
        "PT": ["Táxis Ribeira"],
        "DE": ["Stadttaxi Nord"],
        "MX": ["Autobuses del Sol"],
    },
    "OFFICE": {
        "BR": ["Papelaria Ponto Final"],
        "US": ["Paper Trail Supply"],
        "PT": ["Papelaria Central"],
        "DE": ["Bürobedarf Kranich"],
        "MX": ["Papelería Lápiz Azul"],
    },
}

# (item, price in major units at scale 1) per category and language.
ITEMS: dict[str, dict[str, list[tuple[str, int]]]] = {
    "MEALS": {
        "pt": [("Prato do dia", 14), ("Suco natural", 4), ("Cafe expresso", 2), ("Sobremesa", 5)],
        "en": [("Lunch special", 14), ("Iced tea", 3), ("Coffee", 2), ("Pie slice", 5)],
        "de": [("Tagesgericht", 13), ("Apfelschorle", 3), ("Kaffee", 2), ("Kuchen", 4)],
        "es": [("Comida corrida", 9), ("Agua fresca", 2), ("Cafe de olla", 2), ("Postre", 3)],
    },
    "LODGING": {
        "pt": [("Diaria standard", 120), ("Cafe da manha", 12), ("Estacionamento", 10)],
        "en": [("Room night", 140), ("Breakfast", 15), ("Parking", 18)],
        "de": [("Übernachtung", 110), ("Frühstück", 14), ("Parkplatz", 12)],
        "es": [("Noche habitacion", 70), ("Desayuno", 8), ("Estacionamiento", 6)],
    },
    "TRAVEL": {
        "pt": [("Corrida aeroporto", 30), ("Bagagem", 5), ("Pedagio", 3)],
        "en": [("Airport ride", 42), ("Luggage", 5), ("Toll", 4)],
        "de": [("Fahrt Flughafen", 38), ("Gepäck", 4), ("Wartezeit", 6)],
        "es": [("Boleto de autobus", 25), ("Equipaje", 4), ("Seguro de viaje", 3)],
    },
    "OFFICE": {
        "pt": [("Resma papel A4", 6), ("Canetas (cx)", 4), ("Grampeador", 7)],
        "en": [("Printer paper", 8), ("Pens (box)", 5), ("Stapler", 9)],
        "de": [("Druckerpapier", 6), ("Kugelschreiber", 4), ("Hefter", 8)],
        "es": [("Papel bond", 4), ("Plumas (caja)", 3), ("Engrapadora", 5)],
    },
}

# kind -> (locales, how many go to the dev split). 30 cases: 10 dev, 20 test.
PLAN: dict[str, tuple[list[str], int]] = {
    "clean": (["BR", "US", "PT", "DE", "MX"], 2),
    "ambiguous_date": (["BR", "US", "US", "BR", "MX"], 2),
    "tip_discount": (["BR", "US", "PT", "DE", "US"], 2),
    "cash_change": (["BR", "US", "MX", "PT"], 1),
    "thousands": (["BR", "US", "DE", "MX"], 1),
    "dollar_mx": (["MX", "MX", "MX"], 1),
    "low_contrast": (["BR", "US"], 1),
    "unreadable": (["BR", "US"], 0),
}

WHY_HARD = {
    "clean": "Baseline: everything printed plainly.",
    "ambiguous_date": "Day and month are both <= 12; only the locale tells dd/mm from mm/dd.",
    "tip_discount": "The total differs from the subtotal (tax, tip or discount).",
    "cash_change": "Cash paid and change are printed and are larger than the total.",
    "thousands": "The total uses a thousands separator (1.234,56 vs 1,234.56).",
    "dollar_mx": "Mexican receipt: '$' means MXN, not USD.",
    "low_contrast": "Faded ink and a slight blur, but still legible.",
    "unreadable": "Faded away (only '?' left) and blurred: the right answer is null everywhere.",
}


@dataclass(frozen=True)
class Case:
    id: str
    split: str
    kind: str
    locale: str
    expected: dict[str, object]
    layout: Layout


def _smudge(text: str) -> str:
    """Everything but spacing and separators becomes '?' (letters, digits, '$', 'R$'): what is
    left of a receipt that faded away. Even a legible '$' would give the currency away."""
    return re.sub(r"[^\s.,:/-]", "?", text)


def _date(rng: random.Random, ambiguous: bool) -> datetime.date:
    month = rng.randint(1, 10)  # all in the past, relative to the dataset's creation
    # Ambiguous: day <= 12 reads as a month too. Otherwise day >= 13 settles the order.
    day = rng.choice([d for d in range(1, 13) if d != month]) if ambiguous else rng.randint(13, 28)
    return datetime.date(2026, month, day)


def _case(rng: random.Random, number: int, kind: str, locale_code: str) -> Case:
    loc = LOCALES[locale_code]
    # A long hotel stay is the natural way to reach four digits in every currency.
    category = (
        "LODGING" if kind == "thousands" else ["MEALS", "LODGING", "TRAVEL", "OFFICE"][number % 4]
    )
    merchant = ascii_fold(rng.choice(MERCHANTS[category][locale_code]))
    day = _date(rng, ambiguous=kind == "ambiguous_date")

    catalogue = ITEMS[category][loc.lang]
    picked = rng.sample(catalogue, k=min(len(catalogue), rng.randint(2, 3)))
    if kind == "thousands":
        # Lead with the room so the total clears 1,000 in the receipt's currency.
        picked = [catalogue[0], *[p for p in picked if p != catalogue[0]][:1]]
    items: list[tuple[str, int]] = []
    for index, (name, base) in enumerate(picked):
        unit = base * loc.scale * 100 + rng.choice([0, 50, 90])
        quantity = (
            max(3, -(-150_000 * loc.scale // unit)) + rng.randint(0, 2)
            if kind == "thousands" and index == 0
            else rng.randint(1, 2)
        )
        label = ascii_fold(f"{name} x{quantity}" if quantity > 1 else name)
        items.append((label, unit * quantity))
    subtotal = sum(price for _, price in items)

    summary: list[tuple[str, str, bool]] = []
    total = subtotal
    if kind == "tip_discount":
        summary.append((loc.subtotal, loc.money(subtotal), False))
        if loc.tax:
            tax = round(subtotal * 0.0825)
            summary.append((loc.tax, loc.money(tax), False))
            total += tax
        tip = round(subtotal * 0.10)
        summary.append((loc.tip, loc.money(tip), False))
        discount = rng.choice([0, 200, 500]) * loc.scale
        if discount:
            summary.append((loc.discount, "-" + loc.money(discount), False))
        total += tip - discount
    summary.append((loc.total, loc.money(total), True))
    if kind == "cash_change":
        paid = (total // (5000 * loc.scale) + 1) * 5000 * loc.scale
        summary.append((loc.cash, loc.money(paid), False))
        summary.append((loc.change, loc.money(paid - total), False))

    unreadable = kind == "unreadable"
    header = [
        merchant.upper(),
        f"{loc.date(day)} {rng.randint(8, 21):02d}:{rng.randint(0, 59):02d}",
    ]
    item_rows = [(name, loc.money(price)) for name, price in items]
    if unreadable:
        # Blur alone is legible to current models (an earlier version proved it), so the
        # facts themselves are gone: null is then the only right answer.
        header = [_smudge(text) for text in header]
        item_rows = [(_smudge(name), _smudge(amount)) for name, amount in item_rows]
        summary = [(_smudge(label), _smudge(amount), big) for label, amount, big in summary]
    layout = Layout(
        header=header,
        items=item_rows,
        summary=summary,
        footer=[(_smudge if unreadable else str)(ascii_fold(loc.thanks).strip())],
        ink="#a4a4a0" if kind in ("low_contrast", "unreadable") else "#1b1b1b",
        blur=3.2 if unreadable else 0.7 if kind == "low_contrast" else 0.0,
        rotate=round(rng.uniform(-1.2, 1.2), 2),
    )
    expected: dict[str, object] = (
        {"merchant": None, "date": None, "total_minor": None, "currency": None, "category": None}
        if unreadable
        else {
            "merchant": merchant,
            "date": day.isoformat(),
            "total_minor": total,
            "currency": loc.currency,
            "category": category,
        }
    )
    return Case(f"rcpt-{number:03d}", "", kind, locale_code, expected, layout)


def build_dataset(seed: int = SEED) -> list[Case]:
    rng = random.Random(seed)
    cases: list[Case] = []
    number = 1
    for kind, (locales, dev_count) in PLAN.items():
        made = []
        for locale_code in locales:
            made.append(_case(rng, number, kind, locale_code))
            number += 1
        # Split at random within each kind (never by score), so dev and test match.
        dev_ids = {c.id for c in rng.sample(made, k=dev_count)}
        cases.extend(
            Case(c.id, "dev" if c.id in dev_ids else "test", c.kind, c.locale, c.expected, c.layout)
            for c in made
        )
    return cases
