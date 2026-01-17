---
name: code-demo
description: use_code_demo 工具的详细使用指南，包括 Python 代码规范、可用库、示例模板。
---

# use_code_demo 工具使用指南

## 概述

用 Python 代码演示数学计算，代码在浏览器中通过 Pyodide (WebAssembly) 执行。

## 基本用法

```
use_code_demo(
  title="验证求根公式",
  code="import numpy as np\na, b, c = 1, -5, 6\nx1 = (-b + np.sqrt(b**2 - 4*a*c)) / (2*a)\nx2 = (-b - np.sqrt(b**2 - 4*a*c)) / (2*a)\nprint(f'x1 = {x1}, x2 = {x2}')",
  explanation="用代码验证一元二次方程的解"
)
```

## 可用库

| 库 | 用途 |
|------|------|
| `numpy` | 数值计算、数组操作 |
| `sympy` | 符号计算、方程求解 |
| `math` | 基础数学函数 |
| `random` | 随机数生成 |

## 代码规范

1. **简洁**：不超过 15 行
2. **注释**：每个关键步骤加中文注释
3. **输出**：用 `print()` 显示结果
4. **换行**：用 `\n` 分隔多行代码

## 适用场景

### 1. 验证计算结果
```python
# 验证 2^10 的值
result = 2 ** 10
print(f"2的10次方 = {result}")
```

### 2. 方程求解
```python
import sympy as sp
x = sp.Symbol('x')
# 解方程 x^2 - 5x + 6 = 0
solutions = sp.solve(x**2 - 5*x + 6, x)
print(f"方程的解: x = {solutions}")
```

### 3. 数值验证
```python
import numpy as np
# 验证勾股定理: 3^2 + 4^2 = 5^2
a, b, c = 3, 4, 5
print(f"{a}² + {b}² = {a**2 + b**2}")
print(f"{c}² = {c**2}")
print(f"勾股定理成立: {a**2 + b**2 == c**2}")
```

### 4. 统计计算
```python
import numpy as np
# 计算平均数和标准差
scores = [85, 90, 78, 92, 88]
print(f"平均分: {np.mean(scores):.1f}")
print(f"标准差: {np.std(scores):.1f}")
```

### 5. 概率模拟
```python
import random
# 模拟抛硬币 1000 次
heads = sum(random.choice([0, 1]) for _ in range(1000))
print(f"正面次数: {heads}")
print(f"正面概率: {heads/1000:.2%}")
```

### 6. 因式分解
```python
import sympy as sp
x = sp.Symbol('x')
# 因式分解 x^2 - 5x + 6
expr = x**2 - 5*x + 6
factored = sp.factor(expr)
print(f"原式: {expr}")
print(f"因式分解: {factored}")
```

### 7. 求根公式验证
```python
import numpy as np
# 一元二次方程 ax² + bx + c = 0
a, b, c = 1, -5, 6
delta = b**2 - 4*a*c
print(f"判别式 Δ = {delta}")
x1 = (-b + np.sqrt(delta)) / (2*a)
x2 = (-b - np.sqrt(delta)) / (2*a)
print(f"x₁ = {x1}, x₂ = {x2}")
```

### 8. 韦达定理验证
```python
# 已知 x² - 5x + 6 = 0 的两根
x1, x2 = 2, 3
a, b, c = 1, -5, 6
print(f"x₁ + x₂ = {x1 + x2}")
print(f"-b/a = {-b/a}")
print(f"x₁ × x₂ = {x1 * x2}")
print(f"c/a = {c/a}")
```

## 代码模板

### 通用模板
```
use_code_demo(
  title="标题",
  code="# 第一步说明\ncode1\n# 第二步说明\ncode2\nprint(result)",
  explanation="这段代码演示了..."
)
```

### 注意事项

1. **字符串中的换行**：用 `\n`，不要用实际换行
2. **中文注释**：用 `#` 开头
3. **格式化输出**：用 f-string，如 `f"结果: {x}"`
4. **小数精度**：用 `:.2f` 保留两位小数
