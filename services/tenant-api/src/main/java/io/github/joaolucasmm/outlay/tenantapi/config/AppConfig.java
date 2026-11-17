package io.github.joaolucasmm.outlay.tenantapi.config;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;
import io.github.joaolucasmm.outlay.tenantapi.api.model.Problem;
import java.io.IOException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AppConfig {

  /** Same shape as the mock and the browser's {@code toISOString()}: always UTC, milliseconds. */
  static final DateTimeFormatter ISO_MILLIS =
      DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSSX");

  /** Problem Details leave out an absent {@code detail} and an empty {@code errors}. */
  @JsonInclude(JsonInclude.Include.NON_EMPTY)
  abstract static class ProblemMixin {}

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
