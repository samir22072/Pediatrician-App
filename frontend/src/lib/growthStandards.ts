// Simplified WHO Growth Standards (0-5 Years) - Z-Scores
// Format: { age: years, -3sd, -2sd, 0sd, 2sd, 3sd } in kg or cm

export const BOYS_WEIGHT_AGE_Z = [
    { age: 0, sd3neg: 2.1, sd2neg: 2.5, sd0: 3.3, sd2: 4.4, sd3: 5.0 },
    { age: 1, sd3neg: 7.7, sd2neg: 8.6, sd0: 10.2, sd2: 12.0, sd3: 13.0 },
    { age: 2, sd3neg: 9.7, sd2neg: 10.8, sd0: 12.6, sd2: 14.8, sd3: 16.0 },
    { age: 3, sd3neg: 11.3, sd2neg: 12.7, sd0: 14.7, sd2: 17.0, sd3: 18.5 },
    { age: 4, sd3neg: 12.7, sd2neg: 14.3, sd0: 16.7, sd2: 19.5, sd3: 21.0 },
    { age: 5, sd3neg: 14.1, sd2neg: 15.9, sd0: 18.7, sd2: 22.0, sd3: 24.0 },
];

export const GIRLS_WEIGHT_AGE_Z = [
    { age: 0, sd3neg: 2.0, sd2neg: 2.4, sd0: 3.2, sd2: 4.2, sd3: 4.8 },
    { age: 1, sd3neg: 7.0, sd2neg: 7.9, sd0: 9.5, sd2: 11.5, sd3: 12.5 },
    { age: 2, sd3neg: 9.0, sd2neg: 10.2, sd0: 12.0, sd2: 14.4, sd3: 15.8 },
    { age: 3, sd3neg: 10.8, sd2neg: 12.2, sd0: 14.3, sd2: 17.0, sd3: 18.8 },
    { age: 4, sd3neg: 12.3, sd2neg: 14.0, sd0: 16.5, sd2: 19.8, sd3: 22.0 },
    { age: 5, sd3neg: 13.7, sd2neg: 15.6, sd0: 18.5, sd2: 22.4, sd3: 25.0 },
];

export const BOYS_HEIGHT_AGE_Z = [
    { age: 0, sd3neg: 44.2, sd2neg: 46.1, sd0: 49.9, sd2: 53.7, sd3: 55.6 },
    { age: 1, sd3neg: 68.6, sd2neg: 71.0, sd0: 75.7, sd2: 80.5, sd3: 82.9 },
    { age: 2, sd3neg: 80.0, sd2neg: 82.5, sd0: 88.0, sd2: 93.0, sd3: 96.0 }, // Approx
    { age: 3, sd3neg: 87.0, sd2neg: 90.0, sd0: 96.1, sd2: 102.0, sd3: 105.0 },
    { age: 4, sd3neg: 94.0, sd2neg: 97.0, sd0: 103.3, sd2: 110.0, sd3: 113.0 },
    { age: 5, sd3neg: 100.0, sd2neg: 103.0, sd0: 110.0, sd2: 117.0, sd3: 120.0 },
];

export const GIRLS_HEIGHT_AGE_Z = [
    { age: 0, sd3neg: 43.6, sd2neg: 45.4, sd0: 49.1, sd2: 52.9, sd3: 54.7 },
    { age: 1, sd3neg: 66.2, sd2neg: 68.9, sd0: 74.0, sd2: 79.2, sd3: 81.7 },
    { age: 2, sd3neg: 78.0, sd2neg: 80.0, sd0: 86.4, sd2: 92.0, sd3: 95.0 },
    { age: 3, sd3neg: 85.0, sd2neg: 88.0, sd0: 95.1, sd2: 101.0, sd3: 104.0 },
    { age: 4, sd3neg: 92.0, sd2neg: 95.0, sd0: 102.7, sd2: 109.0, sd3: 112.0 },
    { age: 5, sd3neg: 98.0, sd2neg: 101.0, sd0: 109.4, sd2: 116.0, sd3: 119.0 },
];
