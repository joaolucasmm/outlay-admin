package io.github.joaolucasmm.outlay.tenantapi;

import static io.github.joaolucasmm.outlay.tenantapi.support.Api.BLUEFIN_ADMIN;
import static io.github.joaolucasmm.outlay.tenantapi.support.Api.OPERATOR;
import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import io.github.joaolucasmm.outlay.tenantapi.support.Api;
import io.github.joaolucasmm.outlay.tenantapi.support.IntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * The same scenarios as the web mock's handler tests (apps/web/src/mocks/handlers/
 * handlers.test.ts, audit.test.ts, onboarding.test.ts), so the UI behaves the same against
 * either backend.
 */
class ParityIT extends IntegrationTest {

  private Api.Response transition(String persona, String tenantId, Map<String, String> command) {
    return api.post("/tenants/{tenantId}/transitions", tenantId).as(persona).body(command).send();
  }

  @Test
  void rejectsRequestsWithoutAPersona() {
    assertThat(api.get("/tenants").send().status()).isEqualTo(401);
    assertThat(api.get("/tenants").as("per_nobody").send().status()).isEqualTo(401);
  }

  @Test
  void scopesTheTenantListToAProgramAdminsOwnTenant() {
    JsonNode body = api.get("/tenants").as(BLUEFIN_ADMIN).send().body();
    assertThat(texts(body.get("items"), "id")).containsExactly("tnt_bluefin");
  }

  @Test
  void returns403WhenAProgramAdminRunsALifecycleAction() {
    var response =
        transition(BLUEFIN_ADMIN, "tnt_bluefin", Map.of("action", "suspend", "reason", "x"));
    assertThat(response.status()).isEqualTo(403);
    assertThat(response.body().get("title").asText()).isEqualTo("Forbidden");
    assertThat(
            api.get("/tenants/{tenantId}", "tnt_bluefin").as(OPERATOR).send().body().get("status").asText())
        .isEqualTo("active");
  }

  @Test
  void returns409ForATransitionTheStatusDoesNotAllow() {
    assertThat(transition(OPERATOR, "tnt_bluefin", Map.of("action", "activate")).status())
        .isEqualTo(409);
  }

  @Test
  void returns422WithTheOffendingField() {
    var response = transition(OPERATOR, "tnt_bluefin", Map.of("action", "suspend"));
    assertThat(response.status()).isEqualTo(422);
    assertThat(response.body().get("errors").get(0))
        .isEqualTo(
            api.json(
                Map.of("field", "reason", "message", "A reason is required to suspend a tenant.")));
  }

  @Test
  void appliesAValidTransitionAndEmitsAnAuditEvent() {
    var response = transition(OPERATOR, "tnt_tidewater", Map.of("action", "activate"));
    assertThat(response.status()).isEqualTo(200);
    assertThat(response.body().get("id").asText()).isEqualTo("tnt_tidewater");
    assertThat(response.body().get("status").asText()).isEqualTo("active");

    JsonNode latest =
        api.get("/audit-events").as(OPERATOR).param("tenantId", "tnt_tidewater").send()
            .body().get("items").get(0);
    assertThat(latest.get("action").asText()).isEqualTo("tenant.activated");
    assertThat(latest.get("actor"))
        .isEqualTo(api.json(Map.of("id", OPERATOR, "role", "support_operator")));
    assertThat(latest.get("before")).isEqualTo(api.json(Map.of("status", "provisioning")));
    assertThat(latest.get("after")).isEqualTo(api.json(Map.of("status", "active")));
  }

  @Test
  void forbidsAProgramAdminFromReadingAnotherTenantsAuditLog() {
    assertThat(
            api.get("/audit-events").as(BLUEFIN_ADMIN).param("tenantId", "tnt_harbor").send().status())
        .isEqualTo(403);
  }

  @Test
  void paginatesWithAnOpaqueCursor() {
    JsonNode first = api.get("/tenants").as(OPERATOR).param("limit", "3").send().body();
    assertThat(first.get("items")).hasSize(3);
    JsonNode second =
        api.get("/tenants")
            .as(OPERATOR)
            .param("limit", "3")
            .param("cursor", first.get("nextCursor").asText())
            .send()
            .body();
    assertThat(second.get("items").get(0).get("name").asText()).isEqualTo("Kestrel Robotics");
  }

  @Test
  void listsATenantsEventsNewestFirst() {
    JsonNode body = api.get("/audit-events").as(OPERATOR).param("tenantId", "tnt_bluefin").send().body();
    assertThat(texts(body.get("items"), "action"))
        .containsExactly("policy.updated", "category.updated", "tenant.activated", "tenant.created");
  }

  @ParameterizedTest(name = "filters by {0}")
  @CsvSource(
      delimiter = '|',
      value = {
        "actorId=per_admin_tnt_bluefin | policy.updated,category.updated",
        "action=tenant.activated | tenant.activated",
        "entity=category | category.updated",
        "from=2026-03-01T00:00:00Z&to=2026-03-31T23:59:59Z | policy.updated,category.updated",
        "to=2026-02-03T14:12:00.000Z | tenant.created",
        "actorId=per_operator&entity=policy | ''",
      })
  void filtersTheAuditLog(String query, String expected) {
    Api.Request request = api.get("/audit-events").as(OPERATOR).param("tenantId", "tnt_bluefin");
    for (String pair : query.split("&")) {
      String[] kv = pair.split("=", 2);
      request.param(kv[0], kv[1]);
    }
    List<String> actions = texts(request.send().body().get("items"), "action");
    assertThat(actions)
        .containsExactlyElementsOf(expected.isEmpty() ? List.of() : List.of(expected.split(",")));
  }

  @Test
  void keepsAProgramAdminInsideTheirTenantFiltersIncluded() {
    JsonNode body =
        api.get("/audit-events").as(BLUEFIN_ADMIN).param("action", "tenant.suspended").send().body();
    assertThat(body.get("items")).isEmpty();
  }

  @ParameterizedTest(name = "rejects {0} with 422 on {1}")
  @CsvSource(
      delimiter = '|',
      value = {
        "from=yesterday | from",
        "to=2026-13-45 | to",
        "from=2026-04-01T00:00:00Z&to=2026-03-01T00:00:00Z | from",
      })
  void rejectsBadDateRanges(String query, String field) {
    Api.Request request = api.get("/audit-events").as(OPERATOR);
    for (String pair : query.split("&")) {
      String[] kv = pair.split("=", 2);
      request.param(kv[0], kv[1]);
    }
    var response = request.send();
    assertThat(response.status()).isEqualTo(422);
    assertThat(response.body().get("errors").get(0).get("field").asText()).isEqualTo(field);
  }

  @Test
  void createsATenantInProvisioningAndAuditsIt() {
    var response =
        api.post("/tenants")
            .as(OPERATOR)
            .body(Map.of("name", " Acme  Rail ", "country", "PT", "currency", "EUR"))
            .send();
    assertThat(response.status()).isEqualTo(201);
    JsonNode tenant = response.body();
    assertThat(tenant.get("name").asText()).isEqualTo("Acme Rail");
    assertThat(tenant.get("status").asText()).isEqualTo("provisioning");
    assertThat(tenant.get("currency").asText()).isEqualTo("EUR");
    assertThat(tenant.get("id").asText()).matches("tnt_acmerail[0-9a-f]{4}");

    JsonNode latest =
        api.get("/audit-events").as(OPERATOR).param("tenantId", tenant.get("id").asText()).send()
            .body().get("items").get(0);
    assertThat(latest.get("action").asText()).isEqualTo("tenant.created");
    assertThat(latest.get("after")).isEqualTo(tenant);
  }

  @Test
  void rejectsCreatingATenantAsAProgramAdminADuplicateNameOrBadInput() {
    Map<String, String> input = Map.of("name", "Acme", "country", "US", "currency", "USD");
    assertThat(api.post("/tenants").as(BLUEFIN_ADMIN).body(input).send().status()).isEqualTo(403);

    var duplicate =
        api.post("/tenants")
            .as(OPERATOR)
            .body(Map.of("name", "bluefin  LOGISTICS", "country", "US", "currency", "USD"))
            .send();
    assertThat(duplicate.status()).isEqualTo(409);
    assertThat(duplicate.body().get("errors").get(0).get("field").asText()).isEqualTo("name");

    var badCountry =
        api.post("/tenants")
            .as(OPERATOR)
            .body(Map.of("name", "Acme", "country", "XX", "currency", "USD"))
            .send();
    assertThat(badCountry.status()).isEqualTo(422);
  }

  @Test
  void keepsTheCreatedTenantListedForTheOperator() {
    api.post("/tenants")
        .as(OPERATOR)
        .body(Map.of("name", "Acme Rail", "country", "PT", "currency", "EUR"))
        .send();
    JsonNode body = api.get("/tenants").as(OPERATOR).param("q", "acme").send().body();
    assertThat(texts(body.get("items"), "name")).containsExactly("Acme Rail");
  }
}
