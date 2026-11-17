package io.github.joaolucasmm.outlay.tenantapi.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.MissingNode;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.lang.Nullable;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

/** A small HTTP client for tests: persona header, JSON bodies, and contract validation. */
public final class Api {

  public static final String OPERATOR = "per_operator";
  public static final String BLUEFIN_ADMIN = "per_admin_tnt_bluefin";

  /** A response: status and parsed JSON body (a missing node when empty). */
  public record Response(int status, JsonNode body) {}

  private final MockMvc mvc;
  private final ObjectMapper json;
  private final ContractValidator contract;

  public Api(MockMvc mvc, ObjectMapper json, ContractValidator contract) {
    this.mvc = mvc;
    this.json = json;
    this.contract = contract;
  }

  /** A value as a JSON tree, to compare with response bodies. */
  public JsonNode json(Object value) {
    return json.valueToTree(value);
  }

  public Request get(String template, Object... vars) {
    return new Request(HttpMethod.GET, template, vars);
  }

  public Request post(String template, Object... vars) {
    return new Request(HttpMethod.POST, template, vars);
  }

  /** One call, built fluently and sent by {@link #send()}. */
  public final class Request {
    private final HttpMethod method;
    private final String template;
    private final Object[] vars;
    private final Map<String, String> params = new LinkedHashMap<>();
    private @Nullable String persona;
    private @Nullable Object body;

    private Request(HttpMethod method, String template, Object[] vars) {
      this.method = method;
      this.template = template;
      this.vars = vars;
    }

    public Request as(String personaId) {
      this.persona = personaId;
      return this;
    }

    public Request param(String name, String value) {
      params.put(name, value);
      return this;
    }

    public Request body(Object value) {
      this.body = value;
      return this;
    }

    public Response send() {
      try {
        MockHttpServletRequestBuilder request =
            MockMvcRequestBuilders.request(method, template, vars);
        params.forEach(request::param);
        if (persona != null) request.header("X-Demo-Persona", persona);
        if (body != null) {
          request
              .contentType(MediaType.APPLICATION_JSON)
              .content(body instanceof String s ? s : json.writeValueAsString(body));
        }
        MockHttpServletResponse response = mvc.perform(request).andReturn().getResponse();
        String text = response.getContentAsString();
        contract.validate(
            method.name(), template, response.getStatus(), response.getContentType(), text);
        return new Response(
            response.getStatus(), text.isEmpty() ? MissingNode.getInstance() : json.readTree(text));
      } catch (Exception e) {
        throw new IllegalStateException(e);
      }
    }
  }
}
