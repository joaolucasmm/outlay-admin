package io.github.joaolucasmm.outlay.tenantapi;

import static io.github.joaolucasmm.outlay.tenantapi.support.Api.BLUEFIN_ADMIN;
import static io.github.joaolucasmm.outlay.tenantapi.support.Api.OPERATOR;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import io.github.joaolucasmm.outlay.tenantapi.support.IntegrationTest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

/** What the Java service adds beyond mock parity: keyset paging, input edges, demo, CORS. */
class TenantApiIT extends IntegrationTest {

  @Autowired private MockMvc mvc;

  @Test
  void pagesThroughEveryTenantByNameWithoutRepeats() {
    List<String> names = new ArrayList<>();
    String cursor = null;
    do {
      var request = api.get("/tenants").as(OPERATOR).param("limit", "3");
      if (cursor != null) request.param("cursor", cursor);
      JsonNode page = request.send().body();
      names.addAll(texts(page.get("items"), "name"));
      cursor = page.get("nextCursor").isNull() ? null : page.get("nextCursor").asText();
    } while (cursor != null);

    assertThat(names)
        .containsExactly(
            "Bluefin Logistics",
            "Cedar & Pine Studio",
            "Harbor Health Group",
            "Kestrel Robotics",
            "Orbital Freight",
            "Quarry Lane Architects",
            "Saffron Table Restaurants",
            "Tidewater Foods");
  }

  @Test
  void filtersTenantsByStatusAndSearch() {
    JsonNode suspended = api.get("/tenants").as(OPERATOR).param("status", "suspended").send().body();
    assertThat(texts(suspended.get("items"), "id")).containsExactly("tnt_harbor", "tnt_orbital");

    JsonNode search = api.get("/tenants").as(OPERATOR).param("q", " FREIGHT ").send().body();
    assertThat(texts(search.get("items"), "id")).containsExactly("tnt_orbital");

    JsonNode wildcard = api.get("/tenants").as(OPERATOR).param("q", "%").send().body();
    assertThat(wildcard.get("items")).isEmpty();
  }

  @Test
  void rejectsAnUnknownStatusAndAForgedCursor() {
    var status = api.get("/tenants").as(OPERATOR).param("status", "frozen").send();
    assertThat(status.status()).isEqualTo(400);
    assertThat(status.body().get("detail").asText()).isEqualTo("Unknown status \"frozen\".");

    assertThat(api.get("/tenants").as(OPERATOR).param("cursor", "not-a-cursor").send().status())
        .isEqualTo(400);
    assertThat(api.get("/audit-events").as(OPERATOR).param("cursor", "e30").send().status())
        .isEqualTo(400);
  }

  @Test
  void hidesOtherTenantsFromAProgramAdmin() {
    assertThat(api.get("/tenants/{tenantId}", "tnt_bluefin").as(BLUEFIN_ADMIN).send().status())
        .isEqualTo(200);
    assertThat(api.get("/tenants/{tenantId}", "tnt_harbor").as(BLUEFIN_ADMIN).send().status())
        .isEqualTo(404);
    assertThat(api.get("/tenants/{tenantId}", "tnt_nope").as(OPERATOR).send().status())
        .isEqualTo(404);
  }

  @Test
  void runsTheWholeLifecycleWithAuditTrail() {
    String id = "tnt_tidewater";
    var path = "/tenants/{tenantId}/transitions";
    assertThat(api.post(path, id).as(OPERATOR).body(Map.of("action", "activate")).send().status())
        .isEqualTo(200);
    assertThat(
            api.post(path, id)
                .as(OPERATOR)
                .body(Map.of("action", "suspend", "reason", "  Unpaid invoices "))
                .send()
                .status())
        .isEqualTo(200);
    var mismatch =
        api.post(path, id)
            .as(OPERATOR)
            .body(Map.of("action", "deprovision", "confirmationName", "tidewater foods"))
            .send();
    assertThat(mismatch.status()).isEqualTo(422);
    assertThat(mismatch.body().get("errors").get(0).get("field").asText())
        .isEqualTo("confirmationName");
    assertThat(
            api.post(path, id)
                .as(OPERATOR)
                .body(Map.of("action", "deprovision", "confirmationName", "Tidewater Foods"))
                .send()
                .body()
                .get("status")
                .asText())
        .isEqualTo("deprovisioned");

    JsonNode audit = api.get("/audit-events").as(OPERATOR).param("tenantId", id).send().body();
    assertThat(texts(audit.get("items"), "action"))
        .containsExactly("tenant.deprovisioned", "tenant.suspended", "tenant.activated");
    assertThat(audit.get("items").get(1).get("after").get("reason").asText())
        .isEqualTo("Unpaid invoices");

    // A deprovisioned tenant's Program Admin can no longer sign in.
    JsonNode personas = api.get("/demo/personas").send().body();
    assertThat(texts(personas, "id")).doesNotContain("per_admin_tnt_tidewater");
  }

  @Test
  void rejectsAnUnknownLifecycleAction() {
    var response =
        api.post("/tenants/{tenantId}/transitions", "tnt_bluefin")
            .as(OPERATOR)
            .body(Map.of("action", "explode"))
            .send();
    assertThat(response.status()).isEqualTo(422);
    assertThat(response.body().get("errors").get(0).get("field").asText()).isEqualTo("action");
  }

  @Test
  void pagesTheAuditLogNewestFirst() {
    List<String> ids = new ArrayList<>();
    String cursor = null;
    do {
      var request = api.get("/audit-events").as(OPERATOR).param("limit", "3");
      if (cursor != null) request.param("cursor", cursor);
      JsonNode page = request.send().body();
      ids.addAll(texts(page.get("items"), "id"));
      cursor = page.get("nextCursor").isNull() ? null : page.get("nextCursor").asText();
    } while (cursor != null);
    assertThat(ids)
        .containsExactly(
            "aud_seed_4",
            "aud_seed_3",
            "aud_seed_2",
            "aud_seed_1",
            "aud_seed_8",
            "aud_seed_7",
            "aud_seed_6",
            "aud_seed_5");
  }

  @Test
  void servesPersonasHealthAndReset() {
    JsonNode personas = api.get("/demo/personas").send().body();
    assertThat(personas.get(0).get("id").asText()).isEqualTo(OPERATOR);
    assertThat(personas.get(0).get("tenantId").isNull()).isTrue();
    assertThat(texts(personas, "id")).contains(BLUEFIN_ADMIN).doesNotContain("per_admin_tnt_quarrylane");

    assertThat(api.get("/health").send().body())
        .isEqualTo(api.json(Map.of("status", "ok", "mode", "live")));

    api.post("/tenants/{tenantId}/transitions", "tnt_tidewater")
        .as(OPERATOR)
        .body(Map.of("action", "activate"))
        .send();
    assertThat(api.post("/demo/reset").send().status()).isEqualTo(204);
    assertThat(
            api.get("/tenants/{tenantId}", "tnt_tidewater").as(OPERATOR).send().body().get("status").asText())
        .isEqualTo("provisioning");
  }

  @Test
  void allowsTheWebAppOriginThroughCors() throws Exception {
    mvc.perform(
            options("/tenants")
                .header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "x-demo-persona,content-type"))
        .andExpect(status().isOk())
        .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));

    mvc.perform(
            options("/tenants")
                .header("Origin", "https://elsewhere.example")
                .header("Access-Control-Request-Method", "GET"))
        .andExpect(status().isForbidden());
  }
}
