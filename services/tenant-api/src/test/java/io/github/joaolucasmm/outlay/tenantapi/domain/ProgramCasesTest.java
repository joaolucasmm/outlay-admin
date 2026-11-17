package io.github.joaolucasmm.outlay.tenantapi.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.joaolucasmm.outlay.tenantapi.api.model.AdminRole;
import io.github.joaolucasmm.outlay.tenantapi.api.model.TenantStatus;
import java.io.IOException;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Runs packages/domain/fixtures/program-cases.json, the same cases as
 * packages/domain/src/program.test.ts, so the Java and TypeScript program rules stay identical.
 */
class ProgramCasesTest {

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final Path FIXTURES = Path.of("../../packages/domain/fixtures");
  private static final JsonNode CASES = read("program-cases.json");

  static JsonNode read(String file) {
    try {
      return JSON.readTree(FIXTURES.resolve(file).toFile());
    } catch (IOException e) {
      throw new IllegalStateException("Shared fixture not found: " + file, e);
    }
  }

  private static Stream<Arguments> named(String group) {
    return StreamSupport.stream(CASES.get(group).spliterator(), false)
        .map(c -> Arguments.of(Named.of(c.get("name").asText(), c)));
  }

  /** Through text, so a long and an int with the same value compare equal. */
  private static JsonNode tree(Object value) {
    try {
      return JSON.readTree(JSON.writeValueAsString(value));
    } catch (IOException e) {
      throw new IllegalStateException(e);
    }
  }

  private static <T> JsonNode actual(Result<T, List<FieldError>> result) {
    return switch (result) {
      case Result.Ok<T, List<FieldError>>(var value) ->
          tree(Map.of("ok", true, "value", value));
      case Result.Err<T, List<FieldError>>(var errors) ->
          tree(Map.of("ok", false, "errors", errors));
    };
  }

  private static String text(JsonNode node, String field) {
    return node.hasNonNull(field) ? node.get(field).asText() : null;
  }

  static Stream<Arguments> accessCases() {
    return StreamSupport.stream(CASES.get("programWriteAccess").spliterator(), false)
        .map(
            c ->
                Arguments.of(
                    AdminRole.fromValue(c.get("role").asText()),
                    TenantStatus.fromValue(c.get("status").asText()),
                    c.get("expect").asText()));
  }

  @ParameterizedTest(name = "{0} on a {1} tenant → {2}")
  @MethodSource("accessCases")
  void programWriteAccess(AdminRole role, TenantStatus status, String expected) {
    String actual =
        switch (ProgramAccess.write(role, status)) {
          case Result.Ok<Boolean, ProgramAccess.Denial> ok -> "ok";
          case Result.Err<Boolean, ProgramAccess.Denial>(var denial) -> denial.code();
        };
    assertThat(actual).isEqualTo(expected);
  }

  static Stream<Arguments> categoryCases() {
    return named("categoryFields");
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("categoryCases")
  void categoryFields(JsonNode c) {
    JsonNode input = c.get("input");
    CategoryFields fields = CategoryFields.of(text(input, "code"), text(input, "name"));
    if (input.has("glAccount")) fields = fields.withGlAccount(text(input, "glAccount"));

    JsonNode expected = c.get("expect");
    switch (fields.validate()) {
      case Result.Ok<CategoryFields, List<FieldError>>(var valid) -> {
        // Only the fields that were sent come back, as in the TypeScript Partial.
        Map<String, Object> value = new LinkedHashMap<>();
        if (valid.code() != null) value.put("code", valid.code());
        if (valid.name() != null) value.put("name", valid.name());
        if (valid.hasGlAccount()) value.put("glAccount", valid.glAccount());
        assertThat(tree(Map.of("ok", true, "value", value))).isEqualTo(expected);
      }
      case Result.Err<CategoryFields, List<FieldError>> err ->
          assertThat(actual(err)).isEqualTo(expected);
    }
  }

  static Stream<Arguments> policyCases() {
    return named("policyRule");
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("policyCases")
  void policyRule(JsonNode c) {
    JsonNode in = c.get("input");
    var rule =
        new PolicyRuleFields(
            in.get("limitMinor").asLong(),
            in.get("receiptRequiredAboveMinor").asLong(),
            in.get("approvalLevels").asInt());
    assertThat(actual(rule.validate())).isEqualTo(c.get("expect"));
  }

  private static EmployeeImport.Row row(JsonNode r) {
    return new EmployeeImport.Row(
        r.get("name").asText(),
        r.get("email").asText(),
        r.get("role").asText(),
        r.get("costCenter").asText());
  }

  static Stream<Arguments> employeeCases() {
    return named("employeeRow");
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("employeeCases")
  void employeeRow(JsonNode c) {
    assertThat(actual(EmployeeImport.validateRow(row(c.get("input"))))).isEqualTo(c.get("expect"));
  }

  static Stream<Arguments> importCases() {
    return named("employeeImport");
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("importCases")
  void employeeImport(JsonNode c) {
    List<EmployeeImport.Row> rows =
        StreamSupport.stream(c.get("rows").spliterator(), false).map(ProgramCasesTest::row).toList();
    List<String> existing = JSON.convertValue(c.get("existingEmails"), new TypeReference<>() {});

    var result = EmployeeImport.validate(rows, existing);

    assertThat(result.valid().stream().map(EmployeeImport.ValidRow::index).toList())
        .isEqualTo(JSON.convertValue(c.get("expect").get("valid"), new TypeReference<List<Integer>>() {}));
    assertThat(tree(result.invalid())).isEqualTo(c.get("expect").get("invalid"));
  }

  static Stream<Arguments> templateCases() {
    return named("template");
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("templateCases")
  void template(JsonNode c) throws IOException {
    CategoryTemplate template =
        JSON.treeToValue(read("category-template.json"), CategoryTemplate.class);
    Set<String> skip = new HashSet<>(JSON.convertValue(c.get("skipCodes"), new TypeReference<List<String>>() {}));

    var program =
        template.programFor(
            c.get("tenant").get("id").asText(), c.get("tenant").get("currency").asText(), skip);

    assertThat(tree(program)).isEqualTo(c.get("expect"));
  }
}
