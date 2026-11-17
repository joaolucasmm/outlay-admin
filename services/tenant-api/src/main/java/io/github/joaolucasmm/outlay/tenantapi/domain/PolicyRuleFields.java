package io.github.joaolucasmm.outlay.tenantapi.domain;

import java.util.ArrayList;
import java.util.List;

/**
 * One cell of the policy grid. Mirrors validatePolicyRule in packages/domain/src/policy.ts. Money
 * is in integer minor units of the tenant currency.
 */
public record PolicyRuleFields(long limitMinor, long receiptRequiredAboveMinor, int approvalLevels) {

  public Result<PolicyRuleFields, List<FieldError>> validate() {
    List<FieldError> errors = new ArrayList<>();
    if (limitMinor < 0) {
      errors.add(new FieldError("limitMinor", "The limit must be zero or more."));
    }
    if (receiptRequiredAboveMinor < 0) {
      errors.add(
          new FieldError(
              "receiptRequiredAboveMinor", "The receipt threshold must be zero or more."));
    } else if (receiptRequiredAboveMinor > limitMinor) {
      errors.add(
          new FieldError(
              "receiptRequiredAboveMinor", "The receipt threshold cannot be above the limit."));
    }
    if (approvalLevels < 0 || approvalLevels > 2) {
      errors.add(new FieldError("approvalLevels", "Approvals must be 0, 1 or 2."));
    }
    return errors.isEmpty() ? Result.ok(this) : Result.err(List.copyOf(errors));
  }
}
