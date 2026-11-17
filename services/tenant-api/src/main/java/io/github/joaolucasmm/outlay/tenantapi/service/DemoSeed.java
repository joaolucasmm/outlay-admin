package io.github.joaolucasmm.outlay.tenantapi.service;

import javax.sql.DataSource;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Puts the demo data back by re-running the same script Flyway loaded (db/demo). */
@Service
@Profile("demo")
public class DemoSeed {

  static final String SCRIPT = "db/demo/R__demo_seed.sql";

  private final DataSource dataSource;

  public DemoSeed(DataSource dataSource) {
    this.dataSource = dataSource;
  }

  @Transactional
  public void reset() {
    new ResourceDatabasePopulator(new ClassPathResource(SCRIPT)).execute(dataSource);
  }
}
