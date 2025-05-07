const TIME_ZONE = 'Asia/Kolkata';

const getColumnWithTZ = (col) => {
  if (col === 'created_at' || col === 'updated_at') {
    return `cb.${col} AT TIME ZONE '${TIME_ZONE}' AS ${col}`;
  } else {
    return `cb.${col}`;
  }
};

export default getColumnWithTZ;
