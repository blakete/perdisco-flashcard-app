Solution to Part 1 (showing that ￼ is a constant)

We start with the augmented “cost” functional:

$$
J \;=\;\int_{0}^{L}\Bigl[\tfrac12\,\bigl(y(s)\,\dot{x}(s)\;-\;x(s)\,\dot{y}(s)\bigr)\;+\;\lambda(s)\,\bigl(\dot{x}(s)^2+\dot{y}(s)^2-1\bigr)\Bigr]\,ds
\;=\;\int_{0}^{L}\mathcal{L}\,ds.
$$

where
$$
\mathcal{L}\bigl(x,y,\dot{x},\dot{y},\lambda\bigr) \;=\;\tfrac12\bigl(y\,\dot{x}-x\,\dot{y}\bigr)\;+\;\lambda\bigl(\dot{x}^2+\dot{y}^2-1\bigr).
$$

The hint is to use the Beltrami identity (sometimes also called the “energy” integral) for a Lagrangian that does not explicitly depend on the independent variable ￼.  In the vector version for coordinates ￼, the Beltrami identity states:

￼

1. Compute the partial derivatives

First, compute the derivatives of ￼ with respect to ￼ and ￼:

$$
\frac{\partial \mathcal{L}}{\partial \dot{x}}
\;=\;\frac12\,y \;+\; 2\,\lambda\,\dot{x},
\qquad
\frac{\partial \mathcal{L}}{\partial \dot{y}}
\;=\;-\tfrac12\,x \;+\; 2\,\lambda\,\dot{y}.
$$

Then multiply each by the corresponding velocity:

$$
\frac{\partial \mathcal{L}}{\partial \dot{x}}\,\dot{x}
\;=\;\bigl(\tfrac12\,y + 2\,\lambda\,\dot{x}\bigr)\,\dot{x}
\;=\;\tfrac12\,y\,\dot{x} + 2\,\lambda\,\dot{x}^2,
$$
$$
\frac{\partial \mathcal{L}}{\partial \dot{y}}\,\dot{y}
\;=\;\bigl(-\tfrac12\,x + 2\,\lambda\,\dot{y}\bigr)\,\dot{y}
\;=\;-\tfrac12\,x\,\dot{y} + 2\,\lambda\,\dot{y}^2.
$$

Summing these gives

$$
\frac{\partial \mathcal{L}}{\partial \dot{x}}\,\dot{x}
\;+\;
\frac{\partial \mathcal{L}}{\partial \dot{y}}\,\dot{y}
\;=\;
\tfrac12\,(y\,\dot{x}-x\,\dot{y})
\;+\;
2\,\lambda\,\bigl(\dot{x}^2+\dot{y}^2\bigr).
$$

2. Plug into the Beltrami identity

Recall

$$
\mathcal{L}
\;=\;\tfrac12\,(y\,\dot{x}-x\,\dot{y})
\;+\;\lambda\,\bigl(\dot{x}^2+\dot{y}^2-1\bigr).
$$

Hence,

$$
\mathcal{L}
\;-\;
\Bigl(\frac{\partial \mathcal{L}}{\partial \dot{x}}\,\dot{x}
\;+\;\frac{\partial \mathcal{L}}{\partial \dot{y}}\,\dot{y}\Bigr)
\;=\;
\Bigl[\tfrac12\,(y\,\dot{x}-x\,\dot{y})+\lambda(\dot{x}^2+\dot{y}^2-1)\Bigr]
\;-\;
\Bigl[\tfrac12\,(y\,\dot{x}-x\,\dot{y})+2\,\lambda\,(\dot{x}^2+\dot{y}^2)\Bigr].
$$

Inside the brackets, the terms \(\tfrac12\,(y\,\dot{x}-x\,\dot{y})\) cancel, leaving

￼

But our constraint is ￼.  Therefore

￼

Hence the Beltrami identity states

￼

Because the left-hand side is ￼, it follows that ￼ itself must be constant with respect to ￼.  Denote that constant by, say, ￼.

￼

This completes the proof that ￼ is constant.