# Second reference for the statistics helpers in web/src/lib/stats/, from
# base R alone (no packages): Wilson score intervals from prop.test without
# the continuity correction, exact sign tests from binom.test, sample means,
# standard deviations and type-7 quantiles. stats.test.ts checks the
# TypeScript helpers against both this file and the Python one.
#
#   Rscript scripts/verify_stats.R
# Writes web/src/lib/stats/__fixtures__/stats-parity-r.json.

args <- commandArgs(trailingOnly = FALSE)
here <- dirname(normalizePath(sub("^--file=", "", args[grep("^--file=", args)])))
out <- file.path(here, "..", "web", "src", "lib", "stats", "__fixtures__", "stats-parity-r.json")

num <- function(x) sprintf("%.17g", x)

wilson_cases <- list(c(0, 10), c(1, 10), c(3, 10), c(10, 10), c(0, 20), c(7, 20), c(19, 20),
                     c(3, 7), c(13, 14), c(45, 60), c(500, 1000))
wilson <- character(0)
for (lv in c(0.95, 0.9)) {
  for (x in wilson_cases) {
    ci <- suppressWarnings(prop.test(x[1], x[2], conf.level = lv, correct = FALSE)$conf.int)
    wilson <- c(wilson, sprintf("[%d,%d,%.2f,%s,%s]", x[1], x[2], lv, num(ci[1]), num(ci[2])))
  }
}

sign_cases <- list(c(1, 0), c(0, 5), c(3, 2), c(7, 1), c(10, 0), c(8, 2), c(5, 5), c(0, 12), c(13, 4), c(40, 25))
sign <- character(0)
for (x in sign_cases) {
  p <- binom.test(x[1], x[1] + x[2], 0.5, alternative = "two.sided")$p.value
  sign <- c(sign, sprintf("[%d,%d,%s]", x[1], x[2], num(p)))
}

a <- c(412.5, 398.1, 455.0, 430.2, 401.7, 470.9, 388.4, 420.0, 441.3, 409.8)
b <- c(455.2, 430.6, 470.1, 468.0, 440.3, 482.5, 430.9, 451.7, 470.2, 433.0)
d <- a - b
q <- quantile(a, c(0.025, 0.25, 0.5, 0.75, 0.975), type = 7)

json <- sprintf(
  paste0('{"source":"R %s (base stats)","wilson":[%s],"signTest":[%s],',
         '"a":{"mean":%s,"sd":%s},"d":{"mean":%s,"sd":%s},"cohensDz":%s,',
         '"quantilesA":[%s]}'),
  paste(R.version$major, R.version$minor, sep = "."),
  paste(wilson, collapse = ","), paste(sign, collapse = ","),
  num(mean(a)), num(sd(a)), num(mean(d)), num(sd(d)), num(mean(d) / sd(d)),
  paste(sprintf("[%s,%s]", c(0.025, 0.25, 0.5, 0.75, 0.975), sapply(q, num)), collapse = ",")
)
writeLines(json, out)
cat("wrote", normalizePath(out), "\n")
