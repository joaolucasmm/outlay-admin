package io.github.joaolucasmm.outlay.tenantapi.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

import com.fasterxml.jackson.core.JsonPointer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;
import org.springframework.lang.Nullable;

/**
 * Checks a response against packages/contracts/openapi.yaml: the status must be documented for the
 * operation, and the body must match that response's JSON Schema. Every integration test call
 * goes through it, so the Java service cannot drift from the contract the web app is typed by.
 */
public final class ContractValidator {

  private static final Path SPEC = Path.of("../../packages/contracts/openapi.yaml");

  private final ObjectMapper json = new ObjectMapper();
  private final JsonNode openapi;
  private final JsonSchemaFactory schemas =
      JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);

  public ContractValidator() {
    try {
      openapi = new ObjectMapper(new YAMLFactory()).readTree(SPEC.toFile());
    } catch (IOException e) {
      throw new IllegalStateException("Cannot read " + SPEC, e);
    }
  }

  public void validate(
      String method,
      String pathTemplate,
      int status,
      @Nullable String contentType,
      String body) {
    String where = method + " " + pathTemplate + " → " + status;
    JsonNode operation =
        openapi.at(
            JsonPointer.compile(
                "/paths/" + escape(pathTemplate) + "/" + method.toLowerCase(Locale.ROOT)));
    if (operation.isMissingNode()) {
      fail("Operation not in the contract: %s %s", method, pathTemplate);
    }

    JsonNode response = operation.path("responses").path(String.valueOf(status));
    if (response.isMissingNode()) {
      fail("Status not documented in the contract: %s", where);
    }
    response = resolve(response);

    JsonNode content = response.path("content");
    if (content.isMissingNode()) {
      assertThat(body).as("%s has no body in the contract", where).isEmpty();
      return;
    }
    assertThat(contentType).as("%s content type", where).isNotNull();
    String mediaType = contentType.split(";")[0].trim();
    JsonNode schema = content.path(mediaType).path("schema");
    if (schema.isMissingNode()) {
      fail("Content type %s not documented for %s", mediaType, where);
    }

    ObjectNode root = json.createObjectNode();
    root.set("components", openapi.get("components"));
    root.setAll((ObjectNode) schema);
    try {
      Set<ValidationMessage> errors = schemas.getSchema(root).validate(json.readTree(body));
      assertThat(errors).as("%s does not match the contract. Body: %s", where, body).isEmpty();
    } catch (IOException e) {
      fail("%s returned invalid JSON: %s", where, body);
    }
  }

  private JsonNode resolve(JsonNode node) {
    JsonNode ref = node.get("$ref");
    return ref == null ? node : openapi.at(ref.asText().substring(1));
  }

  private static String escape(String path) {
    return path.replace("~", "~0").replace("/", "~1");
  }
}
