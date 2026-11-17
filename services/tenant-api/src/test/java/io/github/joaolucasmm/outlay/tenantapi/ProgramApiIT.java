package io.github.joaolucasmm.outlay.tenantapi;

import static io.github.joaolucasmm.outlay.tenantapi.support.Api.BLUEFIN_ADMIN;
import static io.github.joaolucasmm.outlay.tenantapi.support.Api.OPERATOR;
import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import io.github.joaolucasmm.outlay.tenantapi.support.IntegrationTest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

/** What the Java program API adds beyond mock parity: nulls, ids, paging, limits, concurrency. */
class ProgramApiIT extends IntegrationTest {

  private static final String CATEGORY = "/tenants/{tenantId}/categories/{categoryId}";
  private static final String RULES = "/tenants/{tenantId}/policy-rules";
  private static final String EMPLOYEES = "/tenants/{tenantId}/employees";
  private static final String IMPORT = "/tenants/{tenantId}/employees:import";

  private static Map<String, Object> employee(String email) {
    return Map.of("name", "Zoe Lima", "email", email, "role", "employee", "costCenter", "OPS");
  }

  private static Map<String, Object> rule(String categoryId, String role, int limit) {
    return Map.of(
        "categoryId", categoryId,
        "role", role,
        "limitMinor", limit,
        "receiptRequiredAboveMinor", 0,
        "approvalLevels", 0);
  }

  @Test
  void tellsAnAbsentGlAccountFromANullOne() {
    var rename =
        api.patch(CATEGORY, "tnt_bluefin", "cat_bluefin_meals")
            .as(BLUEFIN_ADMIN)
            .body(Map.of("name", "Meals & drinks"))
            .send();
    assertThat(rename.body().get("glAccount").asText()).isEqualTo("6100");

    var clear =
        api.patch(CATEGORY, "tnt_bluefin", "cat_bluefin_meals")
            .as(BLUEFIN_ADMIN)
            .body("{\"glAccount\": null}")
            .send();
    assertThat(clear.status()).isEqualTo(200);
    assertThat(clear.body().get("glAccount").isNull()).isTrue();
    assertThat(clear.body().get("name").asText()).isEqualTo("Meals & drinks");

    assertThat(
            api.patch(CATEGORY, "tnt_bluefin", "cat_nope").as(BLUEFIN_ADMIN).body(Map.of("active", true)).send().status())
        .isEqualTo(404);
  }

  @Test
  void keepsRuleIdsForCellsThatStayAndDeletesTheRest() {
    var before = api.get(RULES, "tnt_bluefin").as(BLUEFIN_ADMIN).send().body().get("items");
    String mealsEmployeeId = null;
    for (JsonNode r : before) {
      if (r.get("categoryId").asText().equals("cat_bluefin_meals")
          && r.get("role").asText().equals("employee")) {
        mealsEmployeeId = r.get("id").asText();
      }
    }

    var after =
        api.put(RULES, "tnt_bluefin")
            .as(BLUEFIN_ADMIN)
            .body(
                Map.of(
                    "rules",
                    List.of(
                        rule("cat_bluefin_meals", "employee", 99900),
                        rule("cat_bluefin_client_ent", "manager", 50000))))
            .send()
            .body()
            .get("items");

    assertThat(after.get(0).get("id").asText()).isEqualTo(mealsEmployeeId);
    assertThat(after.get(0).get("limitMinor").asInt()).isEqualTo(99900);
    assertThat(after.get(1).get("id").asText()).startsWith("pol_").isNotEqualTo(mealsEmployeeId);
    assertThat(api.get(RULES, "tnt_bluefin").as(BLUEFIN_ADMIN).send().body().get("items"))
        .hasSize(2);

    // Saving the same grid again changes nothing, so nothing is audited.
    String latest = api.get("/audit-events").as(BLUEFIN_ADMIN).send().body().get("items").get(0).get("id").asText();
    api.put(RULES, "tnt_bluefin")
        .as(BLUEFIN_ADMIN)
        .body(
            Map.of(
                "rules",
                List.of(
                    rule("cat_bluefin_meals", "employee", 99900),
                    rule("cat_bluefin_client_ent", "manager", 50000))))
        .send();
    assertThat(api.get("/audit-events").as(BLUEFIN_ADMIN).send().body().get("items").get(0).get("id").asText())
        .isEqualTo(latest);
  }

  @Test
  void pagesEmployeesByNameWithoutRepeats() {
    List<String> ids = new ArrayList<>();
    String cursor = null;
    do {
      var request = api.get(EMPLOYEES, "tnt_bluefin").as(BLUEFIN_ADMIN).param("limit", "5");
      if (cursor != null) request.param("cursor", cursor);
      JsonNode page = request.send().body();
      ids.addAll(texts(page.get("items"), "id"));
      cursor = page.get("nextCursor").isNull() ? null : page.get("nextCursor").asText();
    } while (cursor != null);
    assertThat(ids).hasSize(14).doesNotHaveDuplicates();
  }

  @Test
  void pointsAtTheFieldOfAValueOutsideTheContract() {
    var role = api.get(EMPLOYEES, "tnt_bluefin").as(BLUEFIN_ADMIN).param("role", "ceo").send();
    assertThat(role.status()).isEqualTo(400);
    assertThat(role.body().get("detail").asText()).isEqualTo("Unknown role \"ceo\".");

    Map<String, Object> bad = new java.util.HashMap<>(employee("ok@bluefin.example"));
    bad.put("role", "ceo");
    var body =
        api.post(IMPORT, "tnt_bluefin")
            .as(BLUEFIN_ADMIN)
            .body(Map.of("employees", List.of(employee("a@bluefin.example"), bad)))
            .send();
    assertThat(body.status()).isEqualTo(422);
    assertThat(body.body().get("errors").get(0).get("field").asText())
        .isEqualTo("employees[1].role");
  }

  @Test
  void importsAThousandEmployeesAndRefusesMore() {
    List<Map<String, Object>> thousand =
        IntStream.range(0, 1000).mapToObj(i -> employee("bulk" + i + "@bluefin.example")).toList();
    var ok = api.post(IMPORT, "tnt_bluefin").as(BLUEFIN_ADMIN).body(Map.of("employees", thousand)).send();
    assertThat(ok.body()).isEqualTo(api.json(Map.of("imported", 1000)));

    List<Map<String, Object>> tooMany = new ArrayList<>(thousand);
    tooMany.add(employee("one-more@bluefin.example"));
    var refused =
        api.post(IMPORT, "tnt_bluefin").as(BLUEFIN_ADMIN).body(Map.of("employees", tooMany)).send();
    assertThat(refused.status()).isEqualTo(422);
    assertThat(refused.body().get("errors").get(0).get("field").asText()).isEqualTo("employees");
  }

  /**
   * Two imports of the same new email at once: the tenant row lock serializes them, so the
   * second sees the first's employee and answers a precise 422, never a 500 or a duplicate.
   */
  @Test
  void serializesConcurrentImportsOfTheSameEmail() throws Exception {
    Callable<Integer> importOne =
        () ->
            api.post(IMPORT, "tnt_bluefin")
                .as(BLUEFIN_ADMIN)
                .body(Map.of("employees", List.of(employee("race@bluefin.example"))))
                .send()
                .status();
    ExecutorService pool = Executors.newFixedThreadPool(2);
    try {
      List<Future<Integer>> results = pool.invokeAll(List.of(importOne, importOne));
      List<Integer> statuses = new ArrayList<>();
      for (Future<Integer> f : results) statuses.add(f.get());
      assertThat(statuses).containsExactlyInAnyOrder(200, 422);
    } finally {
      pool.shutdownNow();
    }
    JsonNode found =
        api.get(EMPLOYEES, "tnt_bluefin").as(BLUEFIN_ADMIN).param("q", "race@").send().body();
    assertThat(found.get("items")).hasSize(1);
  }

  /** The onboarding wizard's calls, in order, then the new Program Admin at work. */
  @Test
  void onboardsATenantEndToEnd() {
    String id =
        api.post("/tenants")
            .as(OPERATOR)
            .body(Map.of("name", "Zeta Labs", "country", "US", "currency", "USD"))
            .send()
            .body()
            .get("id")
            .asText();
    assertThat(
            api.post("/tenants/{tenantId}/program:apply-template", id)
                .as(OPERATOR)
                .body(Map.of("templateId", "standard"))
                .send()
                .body())
        .isEqualTo(api.json(Map.of("categoriesCreated", 6, "rulesCreated", 16)));
    assertThat(
            api.post(IMPORT, id)
                .as(OPERATOR)
                .body(Map.of("employees", List.of(employee("zoe@zeta.example"))))
                .send()
                .status())
        .isEqualTo(200);
    assertThat(
            api.post("/tenants/{tenantId}/transitions", id)
                .as(OPERATOR)
                .body(Map.of("action", "activate"))
                .send()
                .status())
        .isEqualTo(200);

    String admin = "per_admin_" + id;
    JsonNode rules = api.get(RULES, id).as(admin).send().body().get("items");
    assertThat(rules).hasSize(16);
    // USD has scale 1: the template's 50 for meals is 5000 cents.
    assertThat(
            api.put(RULES, id)
                .as(admin)
                .body(Map.of("rules", List.of(rule("cat_" + id.substring(4) + "_meals", "employee", 6000))))
                .send()
                .status())
        .isEqualTo(200);
    // The operator's onboarding window is closed now that the tenant is active.
    assertThat(
            api.post(IMPORT, id)
                .as(OPERATOR)
                .body(Map.of("employees", List.of(employee("late@zeta.example"))))
                .send()
                .status())
        .isEqualTo(403);
  }

  @Test
  void appliesTheEmptyTemplateAsANoOp() {
    assertThat(
            api.post("/tenants/{tenantId}/program:apply-template", "tnt_tidewater")
                .as(OPERATOR)
                .body(Map.of("templateId", "empty"))
                .send()
                .body())
        .isEqualTo(api.json(Map.of("categoriesCreated", 0, "rulesCreated", 0)));
  }
}
