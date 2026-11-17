package io.github.joaolucasmm.outlay.tenantapi.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import jakarta.annotation.Nullable;

/**
 * Category fields, each optional: a create sends code and name, a patch any subset. Mirrors
 * validateCategoryFields in packages/domain/src/category.ts, including "absent" vs "null" for the
 * GL account.
 *
 * @param code null when absent
 * @param name null when absent
 * @param hasGlAccount whether the GL account was sent at all
 * @param glAccount the GL account, null to clear it
 */
public record CategoryFields(
    @Nullable String code,
    @Nullable String name,
    boolean hasGlAccount,
    @Nullable String glAccount) {

  public static final Pattern CODE = Pattern.compile("^[A-Z][A-Z0-9_]{1,19}$");

  public static CategoryFields of(@Nullable String code, @Nullable String name) {
    return new CategoryFields(code, name, false, null);
  }

  public CategoryFields withGlAccount(@Nullable String value) {
    return new CategoryFields(code, name, true, value);
  }

  /** Validates the fields that are present: trimmed, and a blank GL account becomes null. */
  public Result<CategoryFields, List<FieldError>> validate() {
    List<FieldError> errors = new ArrayList<>();
    String validCode = null;
    String validName = null;
    String validGl = null;

    if (code != null) {
      validCode = Text.trim(code);
      if (!CODE.matcher(validCode).matches()) {
        errors.add(
            new FieldError(
                "code",
                "Use 2–20 capital letters, digits or _, starting with a letter (e.g. MEALS)."));
      }
    }
    if (name != null) {
      validName = Text.trim(name);
      if (validName.isEmpty() || validName.length() > 60) {
        errors.add(new FieldError("name", "Enter a name of up to 60 characters."));
      }
    }
    if (hasGlAccount) {
      String gl = glAccount == null ? "" : Text.trim(glAccount);
      if (gl.length() > 20) {
        errors.add(new FieldError("glAccount", "Keep the GL account under 20 characters."));
      }
      validGl = gl.isEmpty() ? null : gl;
    }
    return errors.isEmpty()
        ? Result.ok(new CategoryFields(validCode, validName, hasGlAccount, validGl))
        : Result.err(List.copyOf(errors));
  }
}
