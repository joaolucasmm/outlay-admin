package io.github.joaolucasmm.outlay.tenantapi.domain;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Validation for a new tenant. Mirrors packages/domain/src/tenant.ts. */
public final class NewTenant {

  /** A problem with one input field, for 422 {@code errors[]}. */
  public record FieldError(String field, String message) {}

  /** A validated tenant: name normalized, country and currency supported. */
  public record Valid(String name, String country, String currency) {}

  /** Supported countries and their default currency. */
  public static final Map<String, String> SUPPORTED_COUNTRIES =
      Map.of(
          "BR", "BRL", "CA", "CAD", "DE", "EUR", "ES", "EUR", "MX", "MXN", "PT", "EUR", "GB",
          "GBP", "US", "USD");

  public static final Set<String> SUPPORTED_CURRENCIES =
      Set.of("BRL", "CAD", "EUR", "GBP", "MXN", "USD");

  private static final Pattern SPACES = Pattern.compile("\\s+", Pattern.UNICODE_CHARACTER_CLASS);
  private static final Pattern NOT_SLUG = Pattern.compile("[^a-z0-9]+");

  private NewTenant() {}

  public static Result<Valid, List<FieldError>> validate(
      String name, String country, String currency) {
    List<FieldError> errors = new ArrayList<>();
    String normalized = normalizeName(name);
    if (normalized.length() < 2 || normalized.length() > 80) {
      errors.add(new FieldError("name", "Enter a company name of 2 to 80 characters."));
    }
    if (!SUPPORTED_COUNTRIES.containsKey(country)) {
      errors.add(new FieldError("country", "Choose a supported country."));
    }
    if (!SUPPORTED_CURRENCIES.contains(currency)) {
      errors.add(new FieldError("currency", "Choose a supported currency."));
    }
    return errors.isEmpty()
        ? Result.ok(new Valid(normalized, country, currency))
        : Result.err(List.copyOf(errors));
  }

  /** Trims and collapses repeated whitespace. */
  public static String normalizeName(String name) {
    return SPACES.matcher(name.strip()).replaceAll(" ");
  }

  /** Tenant names are unique ignoring case and repeated spaces; this is the unique key. */
  public static String nameKey(String name) {
    return normalizeName(name).toLowerCase(Locale.ROOT);
  }

  /** A readable id fragment: "Café Ñandú" becomes "cafenandu". */
  public static String slug(String name) {
    String ascii =
        Normalizer.normalize(name.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "");
    String slug = NOT_SLUG.matcher(ascii).replaceAll("");
    slug = slug.substring(0, Math.min(16, slug.length()));
    return slug.isEmpty() ? "tenant" : slug;
  }
}
