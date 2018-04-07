#version 300 es
precision highp float;

#define PI 3.1415926f

#define SH_C0 0.282094791f // 1 / 2sqrt(pi)
#define SH_C1 0.488602512f // sqrt(3/pi) / 2

/*Cosine lobe coeff*/
#define SH_cosLobe_C0 0.886226925f // sqrt(pi)/2
#define SH_cosLobe_C1 1.02332671f // sqrt(pi/3)

#define CELLSIZE 4.0

uniform int u_texture_size;

uniform sampler2D u_rsm_flux;
uniform sampler2D u_rsm_world_positions;
uniform sampler2D u_rsm_world_normals;

ivec3 directions[6] = ivec3[] (
  ivec3(0,0,1),
  ivec3(0,0,-1),
  ivec3(1,0,0),
  ivec3(-1,0,0),
  ivec3(0,1,0),
  ivec3(0,-1,0)
);

/* 6 neighbours in 3D, 4 in 2D, represented as
   orientation = [ right | up | forward ] = [ x | y | z ]
 */
mat3 neighbours[6] = mat3[] (
    // Z+
    mat3(
    1, 0, 0,
    0, 1, 0,
    0, 0, 1),    //These two are for 3D
    // Z-
    mat3(
    -1, 0, 0,
    0, 1, 0,
    0, 0, -1),
    // X+
    mat3(
    0, 0, 1,
    0, 1, 0,
    -1, 0, 0),
    // X-
    mat3(
    0, 0, -1,
    0, 1, 0,
    1, 0, 0),
    // Y+
    mat3(
    1, 0, 0,
    0, 0, 1,
    0, -1, 0),
    // Y-
    mat3(
    1, 0, 0,
    0, 0, -1,
    0, 1, 0)
);

// Faces in cube
vec2 sideFaces[4] = vec2[] (
    vec2(1.0, 0.0),   // right
    vec2(0.0, 1.0),   // up
    vec2(-1.0, 0.0),  // left
    vec2(0.0, -1.0)   // down
);

vec4 evalCosineLobeToDir(vec3 dir)
{
	dir = normalize(dir);
	//f00, f-11, f01, f11
	return vec4(SH_cosLobe_C0, -SH_cosLobe_C1 * dir.y, SH_cosLobe_C1 * dir.z, -SH_cosLobe_C1 * dir.x);
}

// Get SH coeficients out of direction
vec4 dirToSH(vec3 dir)
{
    return vec4(SH_C0, -SH_C1 * dir.y, SH_C1 * dir.z, -SH_C1 * dir.x);
}

vec3 getEvalSideDirection(int index, mat3 orientation)
{
    const float smallComponent = 0.4472135; // 1 / sqrt(5)
    const float bigComponent = 0.894427; // 2 / sqrt(5)

    vec2 s = sideFaces[index];
    return orientation * vec3(s.x * smallComponent, s.y * smallComponent, bigComponent);
}

vec3 getReprojSideDirection(int index, mat3 orientation)
{
    vec2 s = sideFaces[index];
    return orientation * vec3(s.x, s.y, 0);
}

// Should be run 16*2*1 times? (x,y,z)
// For each cell
void main()
{
    // TODO correct indexes from lpv
    int cellX = 0;
    int cellY = 0;
    ivec3 cellIndex = ivec3(cellX, cellY, 0);

    vec4 contributionR = vec4(0);
    vec4 contributionG = vec4(0);
    vec4 contributionB = vec4(0);

    // Get contribution of neighbouring cells
    for (int neighbour = 0; neighbour < neighbours.length(); ++neighbour)
    {
        mat3 orientation = neighbours[neighbour];
        vec3 mainDirection = orientation * vec3(0, 0, 1);

        ivec3 neighbourIndex = ivec3(cellIndex - directions[neighbour]);

        // TODO these might be incorrect
        vec4 neighbourCoeffsR = texelFetch(u_rsm_flux, neighbourIndex.xy, 0);
        vec4 neighbourCoeffsG = texelFetch(u_rsm_world_positions, neighbourIndex.xy, 0);
        vec4 neighbourCoeffsB = texelFetch(u_rsm_world_normals, neighbourIndex.xy, 0);

        // The solid angles determine the amount of light distributed toward a specific face
        const float directFaceSolidAngle = 0.4006696846f / PI / 2.0f;
        const float sideFaceSolidAngle = 0.4234413544f / PI / 3.0f;

        // For each face of cell, project light onto face
        for (int sideFace = 0; sideFace < sideFaces.length(); ++sideFace)
        {
            vec3 evalDirection = getEvalSideDirection(sideFace, orientation);
            vec3 reprojDirection = getReprojSideDirection(sideFace, orientation);

            vec4 reprojDirectionCosineLobeSH = evalCosineLobeToDir(reprojDirection);
            vec4 evalDirectionSH = dirToSH(evalDirection);

            contributionR += sideFaceSolidAngle * dot(neighbourCoeffsR, evalDirectionSH) * reprojDirectionCosineLobeSH;
            contributionG += sideFaceSolidAngle * dot(neighbourCoeffsG, evalDirectionSH) * reprojDirectionCosineLobeSH;
            contributionB += sideFaceSolidAngle * dot(neighbourCoeffsB, evalDirectionSH) * reprojDirectionCosineLobeSH;
        }

        ivec3 dir = directions[neighbour];
        vec4 cosLobe = evalCosineLobeToDir(vec3(dir));
        vec4 dirSH = dirToSH(vec3(dir));

        contributionR += directFaceSolidAngle * max(0.0f, dot(neighbourCoeffsR, dirSH)) * cosLobe;
        contributionG += directFaceSolidAngle * max(0.0f, dot(neighbourCoeffsG, dirSH)) * cosLobe;
        contributionB += directFaceSolidAngle * max(0.0f, dot(neighbourCoeffsB, dirSH)) * cosLobe;
    }

    // Add contributions of neighbours to this cell
    // This does not work in WebGL
    /*texelFetch(u_rsm_flux, cellIndex.xy, 0) += contributionR;
    texelFetch(u_rsm_world_positions, cellIndex.xy, 0) += contributionG;
    texelFetch(u_rsm_world_normals, cellIndex.xy, 0) += contributionB;*/
}