package io.github.joaolucasmm.outlay.tenantapi;

import static io.github.joaolucasmm.outlay.tenantapi.support.Api.BLUEFIN_ADMIN;
import static io.github.joaolucasmm.outlay.tenantapi.support.Api.HARBOR_ADMIN;
import static io.github.joaolucasmm.outlay.tenantapi.support.Api.OPERATOR;
import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import io.github.joaolucasmm.outlay.tenantapi.support.Api;
import io.github.joaolucasmm.outlay.tenantapi.support.IntegrationTest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * The tenant program scenarios of the web mock's tests (apps/web/src/mocks/handlers/
 * program.test.ts and onboarding.test.ts), against Java and MySQL.
 */
class ProgramParityIT extends IntegrationTest {

  private static final String CATEGORIES = "/tenants/{tenantId}/categories";
  private static final String CATEGORY = "/tenants/{tenantId}/categories/{categoryId}";
  private static final String RULES = "/tenants/{tenantId}/policy-rules";
  private static final String TEMPLATE = "/tenants/{tenantId}/program:apply-template";
  private static final String EMPLOYEES = "/tenants/{tenantId}/employees";
  private static final String IMPORT = "/tenants/{tenantId}/employees:import";
  private static final String MEALS = "cat_bluefin_meals";

  private JsonNode latestAudit(String persona) {
    return api.get("/audit-events").as(persona).send().body().get("items").get(0);
  }

  private static Map<String, String> employee(String email) {
    return Map.of("name", "Zoe Lima", "email", email, "role", "employee", "costCenter", "OPS");
  }

  @Test
  void listsTheTenantCategoriesSortedByCode() {
    var response = api.get(CATEGORIES, "tnt_bluefin").as(BLUEFIN_ADMIN).send();
    assertThat(response.status()).isEqualTo(200);
    assertThat(texts(response.body().get("items"), "code"))
        .containsExactly("CLIENT_ENT", "LODGING", "MEALS", "OFFICE", "SOFTWARE", "TRAVEL");
  }

  @Test
  void forbidsTheSupportOperatorAndHidesOtherTenants() {
    assertThat(api.get(CATEGORIES, "tnt_bluefin").as(OPERATOR).send().status()).isEqualTo(403);
    assertThat(api.get(CATEGORIES, "tnt_kestrel").as(BLUEFIN_ADMIN).send().status())
        .isEqualTo(404);
  }

  @Test
  void createsACategoryAndAuditsIt() {
    var response =
        api.post(CATEGORIES, "tnt_bluefin")
            .as(BLUEFIN_ADMIN)
            .body(Map.of("code", "TRAINING", "name", " Training ", "glAccount", ""))
            .send();
    assertThat(response.status()).isEqualTo(201);
    JsonNode category = response.body();
    assertThat(category.get("code").asText()).isEqualTo("TRAINING");
    assertThat(category.get("name").asText()).isEqualTo("Training");
    assertThat(category.get("glAccount").isNull()).isTrue();
    assertThat(category.get("active").asBoolean()).isTrue();

    JsonNode audit = latestAudit(BLUEFIN_ADMIN);
    assertThat(audit.get("action").asText()).isEqualTo("category.created");
    assertThat(audit.get("entity").asText()).isEqualTo("category");
    assertThat(audit.get("after")).isEqualTo(category);
  }

  @Test
  void rejectsADuplicateCodeAndAnInvalidCode() {
    var duplicate =
        api.post(CATEGORIES, "tnt_bluefin")
            .as(BLUEFIN_ADMIN)
            .body(Map.of("code", "MEALS", "name", "Meals again"))
            .send();
    assertThat(duplicate.status()).isEqualTo(409);
    assertThat(duplicate.body().get("errors").get(0).get("field").asText()).isEqualTo("code");

    var invalid =
        api.post(CATEGORIES, "tnt_bluefin")
            .as(BLUEFIN_ADMIN)
            .body(Map.of("code", "meals", "name", "x"))
            .send();
    assertThat(invalid.status()).isEqualTo(422);
    assertThat(invalid.body().get("errors").get(0).get("field").asText()).isEqualTo("code");
  }

  @Test
  void isReadOnlyWhileTheTenantIsNotActive() {
    var response =
        api.post(CATEGORIES, "tnt_harbor")
            .as(HARBOR_ADMIN)
            .body(Map.of("code", "TRAINING", "name", "Training"))
            .send();
    assertThat(response.status()).isEqualTo(409);
    assertThat(response.body().get("detail").asText())
        .isEqualTo("Harbor Health Group is suspended: its program is read-only.");
    assertThat(api.get(CATEGORIES, "tnt_harbor").as(HARBOR_ADMIN).send().status()).isEqualTo(200);
  }

  @Test
  void updatesACategoryNeverItsCodeAndAuditsOnlyWhatChanged() {
    var response =
        api.patch(CATEGORY, "tnt_bluefin", MEALS)
            .as(BLUEFIN_ADMIN)
            .body(Map.of("active", false, "name", "Meals"))
            .send();
    assertThat(response.status()).isEqualTo(200);
    assertThat(response.body().get("active").asBoolean()).isFalse();
    assertThat(response.body().get("name").asText()).isEqualTo("Meals");

    JsonNode audit = latestAudit(BLUEFIN_ADMIN);
    assertThat(audit.get("action").asText()).isEqualTo("category.updated");
    assertThat(audit.get("before")).isEqualTo(api.json(Map.of("active", true)));
    assertThat(audit.get("after")).isEqualTo(api.json(Map.of("active", false)));

    var codeChange =
        api.patch(CATEGORY, "tnt_bluefin", MEALS).as(BLUEFIN_ADMIN).body(Map.of("code", "FOOD")).send();
    assertThat(codeChange.status()).isEqualTo(422);
    assertThat(codeChange.body().get("errors").get(0).get("field").asText()).isEqualTo("code");
  }

  @Test
  void replacesThePolicyGridAndAuditsTheChangedRules() {
    var response =
        api.put(RULES, "tnt_bluefin")
            .as(BLUEFIN_ADMIN)
            .body(
                Map.of(
                    "rules",
                    List.of(
                        Map.of(
                            "categoryId", MEALS,
                            "role", "employee",
                            "limitMinor", 30000,
                            "receiptRequiredAboveMinor", 10000,
                            "approvalLevels", 1))))
            .send();
    assertThat(response.status()).isEqualTo(200);
    assertThat(response.body().get("items")).hasSize(1);
    assertThat(api.get(RULES, "tnt_bluefin").as(BLUEFIN_ADMIN).send().body().get("items"))
        .hasSize(1);

    JsonNode audit = latestAudit(BLUEFIN_ADMIN);
    assertThat(audit.get("action").asText()).isEqualTo("policy.updated");
    assertThat(audit.get("entity").asText()).isEqualTo("policy");
    JsonNode cell = audit.get("after").get(MEALS + ":employee");
    assertThat(cell.get("limitMinor").asInt()).isEqualTo(30000);
    assertThat(cell.get("approvalLevels").asInt()).isEqualTo(1);
  }

  static List<Arguments> badRules() {
    return List.of(
        Arguments.of(
            "a receipt threshold above the limit",
            Map.of("limitMinor", 100, "receiptRequiredAboveMinor", 200, "approvalLevels", 0),
            "rules[0].receiptRequiredAboveMinor"),
        Arguments.of(
            "an unknown category",
            Map.of(
                "categoryId", "cat_nope",
                "limitMinor", 100,
                "receiptRequiredAboveMinor", 0,
                "approvalLevels", 0),
            "rules[0].categoryId"));
  }

  @ParameterizedTest(name = "rejects {0} (422)")
  @MethodSource("badRules")
  void rejectsABadRule(String label, Map<String, Object> overrides, String field) {
    Map<String, Object> rule = new HashMap<>(Map.of("categoryId", MEALS, "role", "employee"));
    rule.putAll(overrides);
    var response = api.put(RULES, "tnt_bluefin").as(BLUEFIN_ADMIN).body(Map.of("rules", List.of(rule))).send();
    assertThat(response.status()).isEqualTo(422);
    assertThat(response.body().get("errors").get(0).get("field").asText()).isEqualTo(field);
  }

  @Test
  void rejectsTwoRulesForTheSameCategoryAndRole() {
    Map<String, Object> rule =
        Map.of(
            "categoryId", MEALS,
            "role", "employee",
            "limitMinor", 100,
            "receiptRequiredAboveMinor", 0,
            "approvalLevels", 0);
    var response =
        api.put(RULES, "tnt_bluefin").as(BLUEFIN_ADMIN).body(Map.of("rules", List.of(rule, rule))).send();
    assertThat(response.status()).isEqualTo(422);
    assertThat(response.body().get("errors").get(0).get("field").asText()).isEqualTo("rules[1].role");
  }

  @Test
  void appliesTheStandardTemplateOnceThenSkipsExistingCodes() {
    var first =
        api.post(TEMPLATE, "tnt_tidewater").as(OPERATOR).body(Map.of("templateId", "standard")).send();
    assertThat(first.status()).isEqualTo(200);
    assertThat(first.body())
        .isEqualTo(api.json(Map.of("categoriesCreated", 6, "rulesCreated", 16)));

    var again =
        api.post(TEMPLATE, "tnt_tidewater").as(OPERATOR).body(Map.of("templateId", "standard")).send();
    assertThat(again.body().get("categoriesCreated").asInt()).isZero();
  }

  @Test
  void onlyAppliesATemplateWhileOnboardingAsTheOperator() {
    assertThat(
            api.post(TEMPLATE, "tnt_bluefin").as(OPERATOR).body(Map.of("templateId", "standard")).send().status())
        .isEqualTo(409);
    assertThat(
            api.post(TEMPLATE, "tnt_bluefin")
                .as(BLUEFIN_ADMIN)
                .body(Map.of("templateId", "standard"))
                .send()
                .status())
        .isEqualTo(403);
  }

  @Test
  void letsTheOperatorImportWhileProvisioningAndAProgramAdminWhileActive() {
    var operator =
        api.post(IMPORT, "tnt_tidewater")
            .as(OPERATOR)
            .body(
                Map.of(
                    "employees",
                    List.of(employee("a@tidewater.example"), employee("b@tidewater.example"))))
            .send();
    assertThat(operator.status()).isEqualTo(200);
    assertThat(operator.body()).isEqualTo(api.json(Map.of("imported", 2)));

    var admin =
        api.post(IMPORT, "tnt_bluefin")
            .as(BLUEFIN_ADMIN)
            .body(Map.of("employees", List.of(employee("NEW@bluefin.example"))))
            .send();
    assertThat(admin.status()).isEqualTo(200);
    JsonNode found =
        api.get(EMPLOYEES, "tnt_bluefin").as(BLUEFIN_ADMIN).param("q", "new@").send().body();
    assertThat(texts(found.get("items"), "email")).containsExactly("new@bluefin.example");
  }

  static List<Arguments> refusedImports() {
    return List.of(
        Arguments.of("the operator on an active tenant", OPERATOR, "tnt_bluefin", 403),
        Arguments.of("an admin of a suspended tenant", HARBOR_ADMIN, "tnt_harbor", 409),
        Arguments.of("an admin of another tenant", BLUEFIN_ADMIN, "tnt_kestrel", 404));
  }

  @ParameterizedTest(name = "refuses an import by {0}")
  @MethodSource("refusedImports")
  void refusesAnImport(String label, String persona, String tenantId, int status) {
    var response =
        api.post(IMPORT, tenantId)
            .as(persona)
            .body(Map.of("employees", List.of(employee("x@y.example"))))
            .send();
    assertThat(response.status()).isEqualTo(status);
  }

  @Test
  void importsAllOrNothingPointingAtTheBadRows() {
    int before = employeeCount("tnt_bluefin");
    var response =
        api.post(IMPORT, "tnt_bluefin")
            .as(BLUEFIN_ADMIN)
            .body(
                Map.of(
                    "employees",
                    List.of(employee("fresh@bluefin.example"), employee("Ana.Souza@bluefin.example"))))
            .send();
    assertThat(response.status()).isEqualTo(422);
    assertThat(response.body().get("errors"))
        .isEqualTo(
            api.json(
                List.of(
                    Map.of(
                        "field", "employees[1].email",
                        "message", "An employee with this email already exists."))));
    assertThat(employeeCount("tnt_bluefin")).isEqualTo(before);
  }

  @Test
  void listsEmployeesByNameWithSearchAndRoleFilters() {
    JsonNode all = api.get(EMPLOYEES, "tnt_bluefin").as(BLUEFIN_ADMIN).param("limit", "100").send().body();
    List<String> names = texts(all.get("items"), "name");
    assertThat(names).hasSize(14).isSorted();

    JsonNode directors =
        api.get(EMPLOYEES, "tnt_bluefin").as(BLUEFIN_ADMIN).param("role", "director").send().body();
    assertThat(texts(directors.get("items"), "role")).isNotEmpty().containsOnly("director");

    JsonNode search =
        api.get(EMPLOYEES, "tnt_bluefin").as(BLUEFIN_ADMIN).param("q", "ana.souza").send().body();
    assertThat(texts(search.get("items"), "email")).containsExactly("ana.souza@bluefin.example");
  }

  private int employeeCount(String tenantId) {
    return api.get(EMPLOYEES, tenantId)
        .as(BLUEFIN_ADMIN)
        .param("limit", "100")
        .send()
        .body()
        .get("items")
        .size();
  }
}
