package io.github.joaolucasmm.outlay.tenantapi.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.springframework.lang.Nullable;

/**
 * Opaque keyset cursors: the sort key of the last row, as base64url JSON. Unlike offsets they stay
 * correct when rows are inserted while someone pages, and every page is an index range scan.
 */
public final class Cursor {

  /** Tenants are ordered by (name, id). */
  public record TenantKey(String name, String id) {}

  /** Audit events are ordered newest first by (at, id). */
  public record AuditKey(long atMillis, String id) {}

  public static final int DEFAULT_LIMIT = 20;
  public static final int MAX_LIMIT = 100;

  private static final ObjectMapper JSON = new ObjectMapper();

  private Cursor() {}

  public static String encode(Object key) {
    try {
      return Base64.getUrlEncoder().withoutPadding().encodeToString(JSON.writeValueAsBytes(key));
    } catch (IOException e) {
      throw new IllegalStateException(e);
    }
  }

  /** Decodes a cursor; {@code null} when absent, 400 when it is not one of ours. */
  public static <T extends Record> @Nullable T decode(@Nullable String cursor, Class<T> type) {
    if (cursor == null || cursor.isEmpty()) {
      return null;
    }
    try {
      String json = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
      T key = JSON.readValue(json, type);
      for (var component : type.getRecordComponents()) {
        if (component.getAccessor().invoke(key) == null) {
          throw ApiProblem.badRequest("Invalid cursor.");
        }
      }
      return key;
    } catch (ApiProblem e) {
      throw e;
    } catch (Exception e) {
      throw ApiProblem.badRequest("Invalid cursor.");
    }
  }

  /** Same rule as the mock: missing or 0 means the default, then clamped to 1..100. */
  public static int limit(@Nullable Integer limit) {
    if (limit == null || limit == 0) {
      return DEFAULT_LIMIT;
    }
    return Math.min(Math.max(limit, 1), MAX_LIMIT);
  }
}
