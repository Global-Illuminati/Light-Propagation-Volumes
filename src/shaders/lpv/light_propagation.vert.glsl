#version 300 es
precision highp float;

layout (location = 0) in vec2 a_grid_index;

uniform highp int u_grid_size;

vec2 get_grid_output_position() {
    //offset position to middle of texel
    vec2 offsetPosition = a_grid_index + vec2(0.5);
    float f_grid_size = float(u_grid_size);

    return vec2((2.0 * offsetPosition.x) / (f_grid_size * f_grid_size), (2.0 * offsetPosition.y) / f_grid_size) - vec2(1.0);
}

void main() 
{
    vec2 screenPos = get_grid_output_position();
    gl_Position = vec4(screenPos, 0.0, 1.0);
    gl_PointSize = 4.0;
}