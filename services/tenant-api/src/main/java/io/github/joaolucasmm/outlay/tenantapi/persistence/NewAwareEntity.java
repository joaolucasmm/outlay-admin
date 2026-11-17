package io.github.joaolucasmm.outlay.tenantapi.persistence;

import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Transient;
import org.springframework.data.domain.Persistable;

/**
 * Ids are assigned by the service (e.g. {@code cat_bluefin_meals}), so Spring Data cannot tell a
 * new row from an existing one by a null id. This tells it, so {@code save} inserts directly
 * instead of selecting first, and batch inserts stay batched.
 */
@MappedSuperclass
public abstract class NewAwareEntity implements Persistable<String> {

  @Transient private boolean fresh = true;

  @Override
  public boolean isNew() {
    return fresh;
  }

  @PostLoad
  @PostPersist
  void markStored() {
    fresh = false;
  }
}
