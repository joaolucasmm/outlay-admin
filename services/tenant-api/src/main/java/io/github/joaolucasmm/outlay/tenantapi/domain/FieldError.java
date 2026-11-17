package io.github.joaolucasmm.outlay.tenantapi.domain;

/** A problem with one input field, for 422 {@code errors[]}. */
public record FieldError(String field, String message) {}
