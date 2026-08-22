/**
 * Stable cross-client contracts. Generated OpenAPI types should be added here
 * once the API contract is expanded beyond the scaffold document.
 */
export type ApiHealth = {
  status: 'ok';
  service: 'baituna-web';
};

export type ApiError = {
  statusCode: number;
  statusMessage: string;
};
