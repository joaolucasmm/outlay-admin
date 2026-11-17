package io.github.joaolucasmm.outlay.tenantapi.config;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.joaolucasmm.outlay.tenantapi.api.model.Problem;
import io.github.joaolucasmm.outlay.tenantapi.domain.CategoryTemplate;
import java.io.IOException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import org.openapitools.jackson.nullable.JsonNullableModule;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

@Configuration
public class AppConfig {

  /** Same shape as the mock and the browser's {@code toISOString()}: always UTC, milliseconds. */
  static final DateTimeFormatter ISO_MILLIS =
      DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSSX");

  /** Problem Details leave out an absent {@code detail} and an empty {@code errors}. */
  @JsonInclude(JsonInclude.Include.NON_EMPTY)
  abstract static class ProblemMixin {}

  /** Generated DTOs use JsonNullable to tell an absent field from an explicit null. */
  @Bean
  JsonNullableModule jsonNullableModule() {
    return new JsonNullableModule();
  }

  /**
   * The standard program template: packages/domain/fixtures/category-template.json, which the
   * Maven build copies onto the classpath (the TypeScript domain reads the same file).
   */
  @Bean
  CategoryTemplate categoryTemplate(ObjectMapper json) throws IOException {
    try (var in = new ClassPathResource("category-template.json").getInputStream()) {
      return json.readValue(in, CategoryTemplate.class);
    }
  }

  @Bean
  Clock clock() {
    return Clock.systemUTC();
  }

  @Bean
  Jackson2ObjectMapperBuilderCustomizer contractJson() {
    return builder ->
        builder
            .mixIn(Problem.class, ProblemMixin.class)
            .serializerByType(
                OffsetDateTime.class,
                new StdSerializer<>(OffsetDateTime.class) {
                  @Override
                  public void serialize(
                      OffsetDateTime value,
                      com.fasterxml.jackson.core.JsonGenerator gen,
                      com.fasterxml.jackson.databind.SerializerProvider provider)
                      throws IOException {
                    gen.writeString(ISO_MILLIS.format(value.withOffsetSameInstant(ZoneOffset.UTC)));
                  }
                });
  }
}
