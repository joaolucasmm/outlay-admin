package io.github.joaolucasmm.outlay.tenantapi.web;

import io.github.joaolucasmm.outlay.tenantapi.api.model.EmployeeRole;
import io.github.joaolucasmm.outlay.tenantapi.api.model.TenantStatus;
import org.springframework.context.annotation.Configuration;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

  /** Query parameters use the contract's wire values ({@code active}), not Java enum names. */
  @Override
  public void addFormatters(FormatterRegistry registry) {
    registry.addConverter(String.class, TenantStatus.class, TenantStatus::fromValue);
    registry.addConverter(String.class, EmployeeRole.class, EmployeeRole::fromValue);
  }
}
