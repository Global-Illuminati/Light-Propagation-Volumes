#version 300 es

#include <mesh_attributes.glsl>

uniform mat4 u_world_from_local;
uniform mat4 u_light_projection_from_world;

out mat4 o_normal_matrix;
out vec4 o_world_space_position;
out vec3 o_normal;
out vec2 o_tex_coord;

void main()
{
	o_tex_coord = a_tex_coord;
	o_normal = a_normal;
	o_world_space_position = u_world_from_local * vec4(a_position, 1.0);
	o_normal_matrix = transpose(inverse(u_world_from_local));
	gl_Position = u_light_projection_from_world * u_world_from_local * vec4(a_position, 1.0);
}
