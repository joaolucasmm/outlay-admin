package io.github.joaolucasmm.outlay.tenantapi.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import jakarta.annotation.Nullable;

/**
 * The standard program template, read from packages/domain/fixtures/category-template.json (the
 * same file the TypeScript domain uses). Mirrors programFromTemplate in template.ts.
 *
 * @param scale per-currency multiplier so limits look plausible; 1 when absent
 * @param categories template categories; rules are [limit, receiptAbove, approvals] in major units
 */
@JsonIgnoreProperties(ignoreUnknown = true) // the fixture's "$comment"
public record CategoryTemplate(Map<String, Integer> scale, List<Spec> categories) {

  public record Spec(
      String code,
      String name,
      @Nullable String glAccount,
      boolean active,
      Map<String, List<Integer>> rules) {}

  public record Category(
      String id, String tenantId, String code, String name, @Nullable String glAccount,
      boolean active) {}

  public record Rule(
      String id,
      String tenantId,
      String categoryId,
      String role,
      long limitMinor,
      long receiptRequiredAboveMinor,
      int approvalLevels) {}

  public record Program(List<Category> categories, List<Rule> rules) {}

  /** The template for a tenant, with stable ids; codes in {@code skipCodes} are left out. */
  public Program programFor(String tenantId, String currency, Set<String> skipCodes) {
    // To minor units: every supported currency has 2 decimals.
    long factor = scale.getOrDefault(currency, 1) * 100L;
    String slug = tenantId.replaceFirst("^tnt_", "");
    List<Category> outCategories = new ArrayList<>();
    List<Rule> outRules = new ArrayList<>();

    for (Spec spec : categories) {
      if (skipCodes.contains(spec.code())) continue;
      String key = Text.lower(spec.code());
      String categoryId = "cat_" + slug + "_" + key;
      outCategories.add(
          new Category(
              categoryId, tenantId, spec.code(), spec.name(), spec.glAccount(), spec.active()));
      spec.rules()
          .forEach(
              (role, rule) ->
                  outRules.add(
                      new Rule(
                          "pol_" + slug + "_" + key + "_" + role,
                          tenantId,
                          categoryId,
                          role,
                          rule.get(0) * factor,
                          rule.get(1) * factor,
                          rule.get(2))));
    }
    return new Program(List.copyOf(outCategories), List.copyOf(outRules));
  }
}
