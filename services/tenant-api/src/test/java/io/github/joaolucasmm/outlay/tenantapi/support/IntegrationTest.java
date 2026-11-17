package io.github.joaolucasmm.outlay.tenantapi.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.joaolucasmm.outlay.tenantapi.service.DemoSeed;
import java.util.List;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * The whole service against a real MySQL in a container (Flyway schema + demo seed), reset before
 * every test. Skipped, not failed, on a machine without Docker; CI always has it.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("demo")
@Import(IntegrationTest.Containers.class)
@Testcontainers(disabledWithoutDocker = true)
public abstract class IntegrationTest {

  @TestConfiguration(proxyBeanMethods = false)
  static class Containers {
    /** A Spring bean, so one container serves every test class sharing the cached context. */
    @Bean
    @ServiceConnection
    MySQLContainer<?> mysql() {
      return new MySQLContainer<>("mysql:8.4");
    }
  }

  private static final ContractValidator CONTRACT = new ContractValidator();

  @Autowired private MockMvc mvc;
  @Autowired private ObjectMapper json;
  @Autowired private DemoSeed seed;

  protected Api api;

  @BeforeEach
  void resetDemoData() {
    seed.reset();
    api = new Api(mvc, json, CONTRACT);
  }

  protected static List<String> texts(JsonNode array, String field) {
    return StreamSupport.stream(array.spliterator(), false)
        .map(node -> node.get(field).asText())
        .toList();
  }
}
