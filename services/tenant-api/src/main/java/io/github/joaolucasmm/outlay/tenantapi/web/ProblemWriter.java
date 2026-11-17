package io.github.joaolucasmm.outlay.tenantapi.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

/** Writes Problem Details, from controllers and from the security filter chain alike. */
@Component
public class ProblemWriter {

  private final ObjectMapper json;

  public ProblemWriter(ObjectMapper json) {
    this.json = json;
  }

  public static ResponseEntity<Object> entity(ApiProblem problem) {
    return ResponseEntity.status(problem.status())
        .contentType(MediaType.APPLICATION_PROBLEM_JSON)
        .body(problem.body());
  }

  public void write(HttpServletResponse response, ApiProblem problem) throws IOException {
    response.setStatus(problem.status());
    response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
    json.writeValue(response.getOutputStream(), problem.body());
  }
}
