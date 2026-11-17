package io.github.joaolucasmm.outlay.tenantapi.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.joaolucasmm.outlay.tenantapi.api.model.AdminRole;
import io.github.joaolucasmm.outlay.tenantapi.api.model.LifecycleAction;
import io.github.joaolucasmm.outlay.tenantapi.api.model.LifecycleCommand;
import io.github.joaolucasmm.outlay.tenantapi.api.model.TenantStatus;
import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Runs the same cases as packages/domain/src/lifecycle.test.ts, read from the shared fixture, so
 * the Java and TypeScript lifecycles cannot drift apart.
 */
class LifecycleTest {

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final JsonNode CASES = load();

  private static JsonNode load() {
    try {
      return JSON.readTree(
          Path.of("../../packages/domain/fixtures/lifecycle-cases.json").toFile());
    } catch (IOException e) {
      throw new IllegalStateException("Shared lifecycle fixture not found", e);
    }
  }

  private static Stream<JsonNode> elements(JsonNode node) {
    return StreamSupport.stream(node.spliterator(), false);
  }

  private static List<String> texts(JsonNode node) {
    return elements(node).map(JsonNode::asText).toList();
  }

  static Stream<Arguments> availableActionsCases() {
    return CASES.get("availableActions").properties().stream()
        .map(e -> Arguments.of(TenantStatus.fromValue(e.getKey()), e.getValue()));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("availableActionsCases")
  void availableActions(TenantStatus status, JsonNode expected) {
    List<String> actual =
        Lifecycle.availableActions(status).stream().map(LifecycleAction::getValue).toList();
    assertThat(actual).containsExactlyElementsOf(texts(expected));
  }

  static Stream<Arguments> permissionCases() {
    return CASES.get("permissions").properties().stream()
        .map(e -> Arguments.of(AdminRole.fromValue(e.getKey()), e.getValue()));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("permissionCases")
  void permissions(AdminRole role, JsonNode granted) {
    List<String> expected = texts(granted);
    for (Permission permission : Permission.values()) {
      assertThat(Permission.can(role, permission))
          .as(permission.value())
          .isEqualTo(expected.contains(permission.value()));
    }
    assertThat(expected.stream().map(Permission::fromValue)).hasSize(expected.size());
  }

  static Stream<Arguments> transitionCases() {
    return elements(CASES.get("transitions"))
        .map(c -> Arguments.of(Named.of(c.get("name").asText(), c)));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("transitionCases")
  void transition(JsonNode c) {
    TenantStatus from = TenantStatus.fromValue(c.get("from").asText());
    JsonNode cmd = c.get("command");
    LifecycleCommand command =
        new LifecycleCommand(LifecycleAction.fromValue(cmd.get("action").asText()))
            .reason(cmd.hasNonNull("reason") ? cmd.get("reason").asText() : null)
            .confirmationName(
                cmd.hasNonNull("confirmationName") ? cmd.get("confirmationName").asText() : null);
    AdminRole role = AdminRole.fromValue(c.get("role").asText());
    JsonNode expect = c.get("expect");

    Result<Lifecycle.Outcome, TransitionError> result =
        Lifecycle.transition(CASES.get("tenantName").asText(), from, command, role);

    if (expect.get("ok").asBoolean()) {
      assertThat(result).isInstanceOf(Result.Ok.class);
      Lifecycle.Outcome outcome = ((Result.Ok<Lifecycle.Outcome, TransitionError>) result).value();
      assertThat(outcome.to().getValue()).isEqualTo(expect.get("to").asText());
      assertThat(outcome.event()).isEqualTo(expect.get("event").asText());
      assertThat(outcome.before()).isEqualTo(Map.of("status", from.getValue()));
      assertThat(outcome.after()).isEqualTo(JSON.convertValue(expect.get("after"), Map.class));
    } else {
      assertThat(result).isInstanceOf(Result.Err.class);
      TransitionError error = ((Result.Err<Lifecycle.Outcome, TransitionError>) result).error();
      assertThat(error.code()).isEqualTo(expect.get("code").asText());
      assertThat(error.message()).isEqualTo(expect.get("message").asText());
      assertThat(error.field().orElse(null))
          .isEqualTo(expect.hasNonNull("field") ? expect.get("field").asText() : null);
      if (error instanceof TransitionError.InvalidTransition invalid) {
        assertThat(invalid.from()).isEqualTo(from);
        assertThat(invalid.action()).isEqualTo(command.getAction());
      }
    }
  }

  @Test
  void everyActionHasAFixtureCase() {
    List<String> covered =
        elements(CASES.get("transitions"))
            .map(c -> c.get("command").get("action").asText())
            .toList();
    for (LifecycleAction action : LifecycleAction.values()) {
      assertThat(covered).contains(action.getValue());
    }
  }
}
