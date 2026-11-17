package io.github.joaolucasmm.outlay.tenantapi.service;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Component;

/** "Now" for the services, from the injected {@link Clock}. */
@Component
public class Clocks {

  private final Clock clock;

  public Clocks(Clock clock) {
    this.clock = clock;
  }

  /** Millisecond precision, like the DATETIME(3) columns, so what we return is what we stored. */
  public Instant now() {
    return clock.instant().truncatedTo(ChronoUnit.MILLIS);
  }
}
