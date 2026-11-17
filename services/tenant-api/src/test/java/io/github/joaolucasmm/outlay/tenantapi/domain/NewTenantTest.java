package io.github.joaolucasmm.outlay.tenantapi.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class NewTenantTest {

  @Test
  void normalizesAValidTenant() {
    assertThat(NewTenant.validate("  Acme   Rail ", "PT", "EUR"))
        .isEqualTo(Result.ok(new NewTenant.Valid("Acme Rail", "PT", "EUR")));
  }

  @Test
  void reportsEveryInvalidField() {
    var result = NewTenant.validate(" A ", "XX", "JPY");
    assertThat(result)
        .isEqualTo(
            Result.err(
                List.of(
                    new NewTenant.FieldError("name", "Enter a company name of 2 to 80 characters."),
                    new NewTenant.FieldError("country", "Choose a supported country."),
                    new NewTenant.FieldError("currency", "Choose a supported currency."))));
  }

  @Test
  void rejectsANameLongerThan80() {
    assertThat(NewTenant.validate("x".repeat(81), "US", "USD")).isInstanceOf(Result.Err.class);
    assertThat(NewTenant.validate("x".repeat(80), "US", "USD")).isInstanceOf(Result.Ok.class);
  }

  @Test
  void treatsNamesAsEqualIgnoringCaseAndSpaces() {
    assertThat(NewTenant.nameKey("bluefin  LOGISTICS "))
        .isEqualTo(NewTenant.nameKey("Bluefin Logistics"));
  }

  @ParameterizedTest
  @CsvSource({
    "Bluefin Logistics, bluefinlogistics",
    "Café Ñandú, cafenandu",
    "Saffron Table Restaurants, saffrontablerest",
    "'!!!', tenant"
  })
  void slugs(String name, String slug) {
    assertThat(NewTenant.slug(name)).isEqualTo(slug);
  }
}
