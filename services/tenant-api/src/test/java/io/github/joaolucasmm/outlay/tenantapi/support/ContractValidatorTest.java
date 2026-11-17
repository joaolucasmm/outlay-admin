package io.github.joaolucasmm.outlay.tenantapi.support;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/** The validator that guards every integration test must itself reject what it should. */
class ContractValidatorTest {

  private final ContractValidator contract = new ContractValidator();

  private static final String TENANT =
      """
      {"id":"tnt_bluefin","name":"Bluefin Logistics","country":"BR","currency":"BRL",
       "status":"active","createdAt":"2026-02-03T14:12:00.000Z","updatedAt":"2026-02-04T09:30:00.000Z"}
      """;

  @Test
  void acceptsABodyThatMatchesTheSchema() {
    assertThatCode(
            () ->
                contract.validate(
                    "GET", "/tenants/{tenantId}", 200, "application/json", TENANT))
        .doesNotThrowAnyException();
    assertThatCode(
            () ->
                contract.validate(
                    "GET",
                    "/tenants",
                    200,
                    "application/json",
                    "{\"items\":[" + TENANT + "],\"nextCursor\":null}"))
        .doesNotThrowAnyException();
    assertThatCode(
            () ->
                contract.validate(
                    "POST",
                    "/tenants/{tenantId}/transitions",
                    422,
                    "application/problem+json",
                    "{\"type\":\"t\",\"title\":\"Invalid command\",\"status\":422,"
                        + "\"errors\":[{\"field\":\"reason\",\"message\":\"m\"}]}"))
        .doesNotThrowAnyException();
    assertThatCode(() -> contract.validate("POST", "/demo/reset", 204, null, ""))
        .doesNotThrowAnyException();
  }

  @Test
  void rejectsAWrongEnumAMissingFieldOrANestedTypo() {
    assertThatThrownBy(
            () ->
                contract.validate(
                    "GET",
                    "/tenants/{tenantId}",
                    200,
                    "application/json",
                    TENANT.replace("\"active\"", "\"frozen\"")))
        .isInstanceOf(AssertionError.class);
    assertThatThrownBy(
            () ->
                contract.validate(
                    "GET", "/tenants", 200, "application/json", "{\"items\":[" + TENANT + "]}"))
        .isInstanceOf(AssertionError.class);
    assertThatThrownBy(
            () ->
                contract.validate(
                    "GET",
                    "/tenants",
                    200,
                    "application/json",
                    "{\"items\":[{\"id\":\"x\"}],\"nextCursor\":null}"))
        .isInstanceOf(AssertionError.class);
  }

  @Test
  void rejectsAnUndocumentedStatusOrContentType() {
    assertThatThrownBy(
            () -> contract.validate("GET", "/tenants/{tenantId}", 500, "application/json", "{}"))
        .isInstanceOf(AssertionError.class);
    assertThatThrownBy(
            () -> contract.validate("GET", "/tenants/{tenantId}", 200, "text/plain", TENANT))
        .isInstanceOf(AssertionError.class);
    assertThatThrownBy(() -> contract.validate("DELETE", "/tenants", 200, null, ""))
        .isInstanceOf(AssertionError.class);
  }
}
