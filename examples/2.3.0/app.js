  if (n > 0) {
    X[n][n - 1] = Math.sqrt(n / 2);
    P[n][n - 1] = Math.sqrt(n / 2);
  }
  if (n < N - 1) {
    X[n][n + 1] = Math.sqrt((n + 1) / 2);
    P[n][n + 1] = -Math.sqrt((n + 1) / 2);
  }