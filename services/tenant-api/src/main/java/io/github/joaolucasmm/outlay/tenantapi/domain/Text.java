package io.github.joaolucasmm.outlay.tenantapi.domain;

import java.util.Locale;
import java.util.regex.Pattern;

/** String helpers that behave like their JavaScript counterparts in packages/domain. */
public final class Text {

  /** JavaScript's {@code trim()}: Unicode white space (including NBSP) and the BOM. */
  private static final Pattern EDGES =
      Pattern.compile("^[\\s\\uFEFF]+|[\\s\\uFEFF]+$", Pattern.UNICODE_CHARACTER_CLASS);

  private Text() {}

  public static String trim(String value) {
    return EDGES.matcher(value).replaceAll("");
  }

  /** JavaScript's {@code toLowerCase()}, locale-independent. */
  public static String lower(String value) {
    return value.toLowerCase(Locale.ROOT);
  }
}
